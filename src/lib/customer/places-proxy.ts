import "server-only";

import { BUSINESS_RULES } from "@/lib/config/business-rules";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function authorizePlacesPractice(token: string) {
  if (
    token.length < BUSINESS_RULES.customerToken.minimumLength ||
    !BUSINESS_RULES.customerToken.urlSafePattern.test(token)
  ) {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("pratiche")
    .select("id")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    const message = `Autorizzazione proxy Places fallita: ${error.message}`;
    await reportExternalServiceError({ source: "Supabase", message });
    throw new Error(message);
  }

  return data ? { practiceId: data.id as string } : null;
}

export async function reservePlacesRequest(practiceId: string) {
  const supabase = createAdminSupabaseClient();
  const windowStart = new Date(
    Date.now() - BUSINESS_RULES.placesAutocomplete.rateLimitWindowMs,
  ).toISOString();
  const { data, error } = await supabase.rpc(
    "reserve_place_autocomplete_request",
    {
      requested_practice_id: practiceId,
      window_start: windowStart,
      maximum_requests:
        BUSINESS_RULES.placesAutocomplete.maximumRequestsPerMinute,
    },
  );

  if (error) {
    const message = `Rate limit proxy Places non disponibile: ${error.message}`;
    await reportExternalServiceError({
      source: "Supabase",
      message,
      practiceId,
    });
    throw new Error(message);
  }

  return data === true;
}
