import "server-only";

import type { AgencyRow } from "@/lib/admin/types";
import { reconcileAgencyCoordinates } from "@/lib/domain/agency-google-place";
import {
  reportExternalServiceError,
  reportOperatorAlert,
} from "@/lib/external-service-errors";
import { createGoogleAgencyPlaceSearchProvider } from "@/lib/google/agency-place-search";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AgencyGooglePlaceResult =
  | { ok: true; agency: AgencyRow }
  | { ok: false; error: string; agency: AgencyRow };

const AGENCY_NOT_FOUND_MESSAGE =
  "Agenzia non trovata su Google: correggi nome o indirizzo";

async function saveSearchError(agency: AgencyRow, message: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("agenzie")
    .update({
      import_status: message === AGENCY_NOT_FOUND_MESSAGE ? "not_found" : "pending",
      import_error: message,
    })
    .eq("id", agency.id);
  if (error) {
    await reportExternalServiceError({
      source: "Supabase",
      message: `Salvataggio errore ricerca scheda Google fallito: ${error.message}`,
      context: { agency_id: agency.id },
    });
  }
}

export async function ensureAgencyGooglePlace(
  agency: AgencyRow,
): Promise<AgencyGooglePlaceResult> {
  if (agency.google_place_id) return { ok: true, agency };

  try {
    const provider = createGoogleAgencyPlaceSearchProvider({
      apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    });
    const place = await provider.searchAgency({
      nome: agency.nome,
      indirizzo: agency.indirizzo,
      cap: agency.cap,
      comune: agency.comune,
      provincia: agency.provincia,
    });
    if (!place) {
      await saveSearchError(agency, AGENCY_NOT_FOUND_MESSAGE);
      await reportOperatorAlert({
        source: "Google Places",
        message: AGENCY_NOT_FOUND_MESSAGE,
        context: { agency_id: agency.id },
      });
      return { ok: false, error: AGENCY_NOT_FOUND_MESSAGE, agency };
    }

    const coordinates = reconcileAgencyCoordinates(agency, place);
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("agenzie")
      .update({
        google_place_id: place.placeId,
        google_indirizzo: place.formattedAddress,
        lat: coordinates.lat,
        lng: coordinates.lng,
        import_status: "ok",
        import_error: null,
      })
      .eq("id", agency.id)
      .select("*")
      .single();
    if (error) {
      const message = `Salvataggio scheda Google fallito: ${error.message}`;
      await reportExternalServiceError({
        source: "Supabase",
        message,
        context: { agency_id: agency.id },
      });
      return { ok: false, error: message, agency };
    }

    if (coordinates.corrected) {
      await reportOperatorAlert({
        source: "Import agenzie",
        message: "coordinate corrette dall'import",
        context: {
          agency_id: agency.id,
          coordinate_precedenti: `${agency.lat},${agency.lng}`,
          coordinate_google: `${place.lat},${place.lng}`,
          distanza_metri: String(Math.round((coordinates.distanceKm ?? 0) * 1_000)),
        },
      });
    }

    return { ok: true, agency: data as AgencyRow };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Google Places Text Search: errore sconosciuto";
    await saveSearchError(agency, message);
    await reportExternalServiceError({
      source: "Google Places",
      message,
      context: { agency_id: agency.id },
    });
    return { ok: false, error: message, agency };
  }
}
