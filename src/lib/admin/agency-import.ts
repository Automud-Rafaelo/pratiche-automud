import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AgencyRow } from "@/lib/admin/types";
import { refreshAgencyOpeningHours } from "@/lib/admin/agency-opening-hours";
import { BUSINESS_RULES } from "@/lib/config/business-rules";
import { isAgencyOpeningHoursStale } from "@/lib/domain/agency-opening-hours";
import {
  findAgencyReconciliationMatch,
  isAgencyEligible,
  parseAgencyCsv,
  parseNullableSiNo,
  type CsvAgency,
} from "@/lib/domain/agency-import";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type ImportSummary = {
  csvRows: number;
  created: number;
  updated: number;
  deactivated: number;
  processed: number;
  pendingBefore: number;
  pendingAfter: number;
  withoutGoogleAfter: number;
  missingApiKey: boolean;
};

async function readAgencyCsv(): Promise<CsvAgency[]> {
  const filePath = path.join(process.cwd(), "data", "agenzie.csv");
  return parseAgencyCsv(await readFile(filePath, "utf8"));
}

function nullable(value: string) {
  return value || null;
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
      const { data, error } = await supabase
        .from("agenzie")
        .update({
          ...values,
          import_status: match.google_place_id ? "ok" : "pending",
          import_error: null,
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

  const loadWorkQueue = async () => {
    const { data, error } = await supabase
      .from("agenzie")
      .select("*")
      .order("nome", { ascending: true });
    if (error) {
      throw new Error(`Unable to load pending agencies: ${error.message}`);
    }
    const agencies = (data ?? []) as AgencyRow[];
    const googlePlacePending = agencies.filter(
      (agency) =>
        !agency.google_place_id && agency.import_status !== "not_found",
    );
    const googlePlaceIds = new Set(
      googlePlacePending.map((agency) => agency.id),
    );
    const hoursPending = agencies.filter(
      (agency) =>
        !googlePlaceIds.has(agency.id) &&
        Boolean(agency.google_place_id) &&
        (!agency.orari ||
          isAgencyOpeningHoursStale(agency.orari_aggiornati_at)),
    );
    return {
      queue: [...googlePlacePending, ...hoursPending],
      withoutGoogle: agencies.filter((agency) => !agency.google_place_id)
        .length,
    };
  };
  const initialWork = await loadWorkQueue();
  const pending = initialWork.queue;

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
      await reportExternalServiceError({
        source: "Google Places",
        message: "Google Places: chiave assente",
        context: { agenzie_da_elaborare: String(pending.length) },
      });
    }
    return {
      ...baseSummary,
      processed: 0,
      pendingAfter: pending.length,
      withoutGoogleAfter: initialWork.withoutGoogle,
      missingApiKey: pending.length > 0,
    };
  }

  const batch = pending.slice(0, BUSINESS_RULES.agencyImport.placesBatchSize);
  await Promise.all(
    batch.map(async (agency) => {
      await refreshAgencyOpeningHours(agency.id);
    }),
  );

  const finalWork = await loadWorkQueue();

  return {
    ...baseSummary,
    processed: batch.length,
    pendingAfter: finalWork.queue.length,
    withoutGoogleAfter: finalWork.withoutGoogle,
    missingApiKey: false,
  };
}
