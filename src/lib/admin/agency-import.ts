import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AgencyRow } from "@/lib/admin/types";
import {
  BUSINESS_RULES,
  normalizeAgencyKeyPart,
} from "@/lib/config/business-rules";
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
  | { status: "retry"; error: string };

export type ImportSummary = {
  csvRows: number;
  processed: number;
  pendingBefore: number;
  pendingAfter: number;
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

    const payload = (await response.json()) as {
      error?: { message?: string; status?: string };
      places?: Array<{
        id?: string;
        location?: { latitude?: number; longitude?: number };
        regularOpeningHours?: unknown;
      }>;
    };

    if (!response.ok) {
      const reason =
        payload.error?.message || payload.error?.status || `HTTP ${response.status}`;
      return { status: "retry", error: `Google Places: ${reason}` };
    }
    const place = payload.places?.[0];
    const latitude = place?.location?.latitude;
    const longitude = place?.location?.longitude;

    if (!place) return { status: "not_found" };
    if (
      !place.id ||
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      return {
        status: "retry",
        error: "Google Places: risultato senza coordinate o place ID",
      };
    }

    return {
      status: "ok",
      lat: latitude,
      lng: longitude,
      placeId: place.id,
      openingHours: place.regularOpeningHours ?? null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "errore di rete";
    return { status: "retry", error: `Google Places: ${reason}` };
  }
}

export async function importAgencies(): Promise<ImportSummary> {
  const rows = await readAgencyCsv();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const supabase = createAdminSupabaseClient();

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
          import_error: hasCsvCoordinates ? null : existing?.import_error ?? null,
        },
        { onConflict: "nome_normalizzato,cap_normalizzato" },
      )
      .select("*")
      .single();

    if (upsertError) {
      throw new Error(`Unable to upsert agency: ${upsertError.message}`);
    }

    void upsertedData;
  }

  const { data: pendingData, error: pendingError } = await supabase
    .from("agenzie")
    .select("*")
    .eq("import_status", "pending")
    .or("lat.is.null,lng.is.null")
    .order("import_error", { ascending: true, nullsFirst: true })
    .order("nome", { ascending: true });
  if (pendingError) {
    throw new Error(`Unable to load pending agencies: ${pendingError.message}`);
  }

  const pending = ((pendingData ?? []) as AgencyRow[]).filter(
    (agency) => agency.lat === null || agency.lng === null,
  );
  if (!apiKey) {
    if (pending.length > 0) {
      const { error } = await supabase
        .from("agenzie")
        .update({ import_error: "Google Places: chiave assente" })
        .in(
          "id",
          pending.map((agency) => agency.id),
        );
      if (error) {
        throw new Error(`Unable to save missing-key error: ${error.message}`);
      }
    }
    if (pending.length > 0) {
      console.error(
        "[Google Places] API key missing; pending agencies not processed",
      );
    }
    return {
      csvRows: rows.length,
      processed: 0,
      pendingBefore: pending.length,
      pendingAfter: pending.length,
      missingApiKey: pending.length > 0,
    };
  }

  const batch = pending.slice(0, BUSINESS_RULES.agencyImport.placesBatchSize);
  await Promise.all(
    batch.map(async (agency) => {
      const place = await searchPlace(
        {
          nome: agency.nome,
          email: agency.email ?? "",
          telefono: agency.telefono ?? "",
          indirizzo: agency.indirizzo,
          cap: agency.cap,
          comune: agency.comune,
          provincia: agency.provincia,
          lat: "",
          lng: "",
          maps_url: agency.maps_url ?? "",
        },
        apiKey,
      );

      const update =
        place.status === "ok"
          ? {
              lat: place.lat,
              lng: place.lng,
              google_place_id: place.placeId,
              orari: place.openingHours,
              import_status: "ok",
              import_error: null,
            }
          : place.status === "not_found"
            ? { import_status: "not_found", import_error: null }
            : { import_status: "pending", import_error: place.error };
      if (place.status === "retry") {
        console.error(`[Google Places] ${agency.nome}: ${place.error}`);
      }

      const { error } = await supabase
        .from("agenzie")
        .update(update)
        .eq("id", agency.id);
      if (error) {
        throw new Error(`Unable to save Places result: ${error.message}`);
      }
    }),
  );

  const { count: pendingAfter, error: countError } = await supabase
    .from("agenzie")
    .select("id", { count: "exact", head: true })
    .eq("import_status", "pending")
    .or("lat.is.null,lng.is.null");
  if (countError) {
    throw new Error(`Unable to count pending agencies: ${countError.message}`);
  }

  return {
    csvRows: rows.length,
    processed: batch.length,
    pendingBefore: pending.length,
    pendingAfter: pendingAfter ?? pending.length,
    missingApiKey: false,
  };
}
