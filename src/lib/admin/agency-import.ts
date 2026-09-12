import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AgencyRow } from "@/lib/admin/types";
import { BUSINESS_RULES } from "@/lib/config/business-rules";
import {
  findAgencyReconciliationMatch,
  isAgencyEligible,
  parseAgencyCsv,
  parseNullableSiNo,
  type CsvAgency,
} from "@/lib/domain/agency-import";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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
  created: number;
  updated: number;
  deactivated: number;
  processed: number;
  pendingBefore: number;
  pendingAfter: number;
  missingApiKey: boolean;
};

async function readAgencyCsv(): Promise<CsvAgency[]> {
  const filePath = path.join(process.cwd(), "data", "agenzie.csv");
  return parseAgencyCsv(await readFile(filePath, "utf8"));
}

function nullable(value: string) {
  return value || null;
}

async function searchPlace(
  agency: Pick<
    CsvAgency,
    "nome" | "indirizzo" | "cap" | "comune" | "provincia"
  >,
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
        payload.error?.message ||
        payload.error?.status ||
        `HTTP ${response.status}`;
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
  const { data: existingData, error: existingError } = await supabase
    .from("agenzie")
    .select("*");
  if (existingError) {
    throw new Error(`Unable to load existing agencies: ${existingError.message}`);
  }

  const existing = (existingData ?? []) as AgencyRow[];
  const claimedIds = new Set<string>();
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const match = findAgencyReconciliationMatch(row, existing, claimedIds);
    const delega = parseNullableSiNo(row.delega, `delega for ${row.nome}`);
    const istanza = parseNullableSiNo(row.istanza, `istanza for ${row.nome}`);
    const phone = nullable(row.telefono);
    const values = {
      nome: row.nome,
      email: row.email.toLowerCase(),
      telefono: phone,
      indirizzo: row.indirizzo,
      cap: row.cap,
      comune: row.comune,
      provincia: row.provincia,
      maps_url: nullable(row.maps_url),
      iban: nullable(row.iban),
      intestatario_iban: nullable(row.intestatario_iban),
      costi_pratica: nullable(row.costi_pratica),
      delega,
      istanza,
      attiva: isAgencyEligible({ telefono: phone, delega, istanza }),
    };

    if (match) {
      const hasCoordinates = match.lat !== null && match.lng !== null;
      const { data, error } = await supabase
        .from("agenzie")
        .update({
          ...values,
          ...(hasCoordinates
            ? { import_status: "ok", import_error: null }
            : {}),
        })
        .eq("id", match.id)
        .select("*")
        .single();
      if (error) {
        throw new Error(`Unable to reconcile agency: ${error.message}`);
      }
      claimedIds.add(match.id);
      Object.assign(match, data as AgencyRow);
      updated += 1;
      continue;
    }

    const { data, error } = await supabase
      .from("agenzie")
      .upsert(
        {
          ...values,
          lat: null,
          lng: null,
          google_place_id: null,
          orari: null,
          orari_aggiornati_at: null,
          import_status: "pending",
          import_error: null,
        },
        { onConflict: "email_normalizzata,cap_normalizzato" },
      )
      .select("*")
      .single();
    if (error) throw new Error(`Unable to create agency: ${error.message}`);
    const inserted = data as AgencyRow;
    existing.push(inserted);
    claimedIds.add(inserted.id);
    created += 1;
  }

  const toDeactivate = existing.filter(
    (agency) => !claimedIds.has(agency.id) && agency.attiva,
  );
  if (toDeactivate.length > 0) {
    const { error } = await supabase
      .from("agenzie")
      .update({ attiva: false })
      .in(
        "id",
        toDeactivate.map((agency) => agency.id),
      );
    if (error) {
      throw new Error(`Unable to deactivate old agencies: ${error.message}`);
    }
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

  const baseSummary = {
    csvRows: rows.length,
    created,
    updated,
    deactivated: toDeactivate.length,
    pendingBefore: pending.length,
  };
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
      console.error(
        "[Google Places] API key missing; pending agencies not processed",
      );
    }
    return {
      ...baseSummary,
      processed: 0,
      pendingAfter: pending.length,
      missingApiKey: pending.length > 0,
    };
  }

  const batch = pending.slice(0, BUSINESS_RULES.agencyImport.placesBatchSize);
  await Promise.all(
    batch.map(async (agency) => {
      const place = await searchPlace(agency, apiKey);
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
    ...baseSummary,
    processed: batch.length,
    pendingAfter: pendingAfter ?? pending.length,
    missingApiKey: false,
  };
}
