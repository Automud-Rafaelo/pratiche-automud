import "server-only";

import { ensureAgencyGooglePlace } from "@/lib/admin/agency-google-place";
import type { AgencyRow } from "@/lib/admin/types";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import { createGoogleAgencyOpeningHoursProvider } from "@/lib/google/agency-opening-hours";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AgencyHoursRefreshResult =
  | { ok: true; agency: AgencyRow }
  | { ok: false; error: string; agency: AgencyRow | null };

async function report(
  source: string,
  message: string,
  agencyId: string,
) {
  await reportExternalServiceError({
    source,
    message,
    context: { agency_id: agencyId },
  });
}

export async function refreshAgencyOpeningHours(
  agencyId: string,
): Promise<AgencyHoursRefreshResult> {
  const supabase = createAdminSupabaseClient();
  const { data, error: loadError } = await supabase
    .from("agenzie")
    .select("*")
    .eq("id", agencyId)
    .maybeSingle();
  if (loadError) {
    const message = `Lettura agenzia per aggiornamento orari fallita: ${loadError.message}`;
    await report("Supabase", message, agencyId);
    return { ok: false, error: message, agency: null };
  }
  let agency = data as AgencyRow | null;
  if (!agency) {
    return { ok: false, error: "Agenzia non trovata", agency: null };
  }
  if (!agency.google_place_id) {
    const placeResult = await ensureAgencyGooglePlace(agency);
    if (!placeResult.ok) return placeResult;
    agency = placeResult.agency;
  }
  const googlePlaceId = agency.google_place_id;
  if (!googlePlaceId) {
    const message = "Google Places: place ID assente dopo la ricerca";
    await report("Google Places", message, agencyId);
    return { ok: false, error: message, agency };
  }

  try {
    const provider = createGoogleAgencyOpeningHoursProvider({
      apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    });
    const details = await provider.getOpeningHours(googlePlaceId);
    const updatedAt = new Date().toISOString();
    const hours = {
      regularOpeningHours: details.regularOpeningHours,
      businessStatus: details.businessStatus,
    };
    const { data: updated, error: updateError } = await supabase
      .from("agenzie")
      .update({
        orari: hours,
        orari_aggiornati_at: updatedAt,
        import_error: null,
      })
      .eq("id", agencyId)
      .select("*")
      .single();
    if (updateError) {
      const message = `Salvataggio orari agenzia fallito: ${updateError.message}`;
      await report("Supabase", message, agencyId);
      return { ok: false, error: message, agency };
    }
    return { ok: true, agency: updated as AgencyRow };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Google Places Place Details: errore sconosciuto";
    console.error(`[Google Places] ${message}`, { agencyId });
    const { error: saveError } = await supabase
      .from("agenzie")
      .update({ import_error: message })
      .eq("id", agencyId);
    if (saveError) {
      await report(
        "Supabase",
        `Salvataggio errore aggiornamento orari fallito: ${saveError.message}`,
        agencyId,
      );
    }
    await report("Google Places", message, agencyId);
    return { ok: false, error: message, agency };
  }
}
