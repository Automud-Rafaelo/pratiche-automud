import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AgencyRow } from "@/lib/admin/types";
import { normalizeAgencyKeyPart } from "@/lib/config/business-rules";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const CSV_HEADERS = [
  "nome",
  "email",
  "telefono",
  "indirizzo",
  "cap",
  "comune",
  "provincia",
  "lat",
  "lng",
  "maps_url",
] as const;

type CsvAgency = Record<(typeof CSV_HEADERS)[number], string>;

type PlacesResult =
  | {
      status: "ok";
      lat: number;
      lng: number;
      placeId: string;
      openingHours: unknown | null;
    }
  | { status: "not_found" }
  | { status: "retry" };

export type ImportSummary = {
  rows: number;
  ok: number;
  notFound: number;
  pending: number;
  placesErrors: number;
  missingApiKey: boolean;
};

function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

async function readAgencyCsv(): Promise<CsvAgency[]> {
  const filePath = path.join(process.cwd(), "data", "agenzie.csv");
  const content = await readFile(filePath, "utf8");
  const [headers, ...rows] = parseCsv(content.replace(/^\uFEFF/, ""));

  if (!headers || headers.join(",") !== CSV_HEADERS.join(",")) {
    throw new Error(
      `Unexpected CSV columns. Expected: ${CSV_HEADERS.join(", ")}.`,
    );
  }

  return rows.map((values, rowIndex) => {
    if (values.length !== CSV_HEADERS.length) {
      throw new Error(`Invalid CSV row ${rowIndex + 2}.`);
    }

    return Object.fromEntries(
      CSV_HEADERS.map((header, index) => [header, values[index]?.trim() ?? ""]),
    ) as CsvAgency;
  });
}

function parseCoordinate(value: string, minimum: number, maximum: number) {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

async function searchPlace(
  agency: CsvAgency,
  apiKey: string,
): Promise<PlacesResult> {
  const textQuery = [
    agency.nome,
    agency.indirizzo,
    agency.cap,
    agency.comune,
    agency.provincia,
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.location,places.regularOpeningHours",
        },
        body: JSON.stringify({
          textQuery,
          pageSize: 1,
          languageCode: "it",
          regionCode: "IT",
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) return { status: "retry" };

    const payload = (await response.json()) as {
      places?: Array<{
        id?: string;
        location?: { latitude?: number; longitude?: number };
        regularOpeningHours?: unknown;
      }>;
    };
    const place = payload.places?.[0];
    const latitude = place?.location?.latitude;
    const longitude = place?.location?.longitude;

    if (!place) return { status: "not_found" };
    if (
      !place.id ||
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      return { status: "retry" };
    }

    return {
      status: "ok",
      lat: latitude,
      lng: longitude,
      placeId: place.id,
      openingHours: place.regularOpeningHours ?? null,
    };
  } catch {
    return { status: "retry" };
  }
}

export async function importAgencies(): Promise<ImportSummary> {
  const rows = await readAgencyCsv();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const supabase = createAdminSupabaseClient();
  const summary: ImportSummary = {
    rows: rows.length,
    ok: 0,
    notFound: 0,
    pending: 0,
    placesErrors: 0,
    missingApiKey: !apiKey,
  };

  for (const row of rows) {
    if (!row.nome) {
      throw new Error("Every agency row must include a name.");
    }

    const normalizedName = normalizeAgencyKeyPart(row.nome);
    const normalizedPostalCode = normalizeAgencyKeyPart(row.cap);
    const { data: existingData, error: existingError } = await supabase
      .from("agenzie")
      .select("*")
      .eq("nome_normalizzato", normalizedName)
      .eq("cap_normalizzato", normalizedPostalCode)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Unable to inspect agency: ${existingError.message}`);
    }

    const existing = existingData as AgencyRow | null;
    const csvLat = parseCoordinate(row.lat, -90, 90);
    const csvLng = parseCoordinate(row.lng, -180, 180);
    const hasCsvCoordinates = csvLat !== null && csvLng !== null;
    const hasExistingCoordinates =
      existing?.lat !== null &&
      existing?.lat !== undefined &&
      existing?.lng !== null &&
      existing?.lng !== undefined;
    const phone = row.telefono || null;
    let importStatus = hasCsvCoordinates
      ? "ok"
      : existing?.import_status ?? "pending";

    if (hasExistingCoordinates && importStatus === "pending") {
      importStatus = "ok";
    }

    const { data: upsertedData, error: upsertError } = await supabase
      .from("agenzie")
      .upsert(
        {
          nome: row.nome,
          email: row.email || null,
          telefono: phone,
          indirizzo: row.indirizzo,
          cap: row.cap,
          comune: row.comune,
          provincia: row.provincia,
          lat: hasCsvCoordinates ? csvLat : existing?.lat ?? null,
          lng: hasCsvCoordinates ? csvLng : existing?.lng ?? null,
          maps_url: row.maps_url || null,
          google_place_id: existing?.google_place_id ?? null,
          orari: existing?.orari ?? null,
          attiva: phone ? (existing?.attiva ?? true) : false,
          import_status: importStatus,
        },
        { onConflict: "nome_normalizzato,cap_normalizzato" },
      )
      .select("*")
      .single();

    if (upsertError) {
      throw new Error(`Unable to upsert agency: ${upsertError.message}`);
    }

    let agency = upsertedData as AgencyRow;
    if (
      agency.import_status === "pending" &&
      (agency.lat === null || agency.lng === null) &&
      apiKey
    ) {
      const place = await searchPlace(row, apiKey);

      if (place.status === "ok") {
        const { data, error } = await supabase
          .from("agenzie")
          .update({
            lat: place.lat,
            lng: place.lng,
            google_place_id: place.placeId,
            orari: place.openingHours,
            import_status: "ok",
          })
          .eq("id", agency.id)
          .select("*")
          .single();
        if (error) throw new Error(`Unable to save Places data: ${error.message}`);
        agency = data as AgencyRow;
      } else if (place.status === "not_found") {
        const { data, error } = await supabase
          .from("agenzie")
          .update({ import_status: "not_found" })
          .eq("id", agency.id)
          .select("*")
          .single();
        if (error) throw new Error(`Unable to save import result: ${error.message}`);
        agency = data as AgencyRow;
      } else {
        summary.placesErrors += 1;
      }
    }

    if (agency.import_status === "ok") summary.ok += 1;
    if (agency.import_status === "not_found") summary.notFound += 1;
    if (agency.import_status === "pending") summary.pending += 1;
  }

  return summary;
}
