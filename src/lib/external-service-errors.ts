import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type ExternalServiceError = {
  source: string;
  message: string;
  context?: Record<string, string>;
  practiceId?: string;
};

export async function reportExternalServiceError({
  source,
  message,
  context = {},
  practiceId,
}: ExternalServiceError) {
  console.error(`[${source}] ${message}`, context);

  try {
    const supabase = createAdminSupabaseClient();
    const { error: alertError } = await supabase.from("operator_alerts").insert({
      source,
      message,
      context: practiceId ? { ...context, practice_id: practiceId } : context,
    });

    if (alertError) {
      console.error("Unable to create operator alert", alertError.message);
    }

    if (practiceId) {
      const { error: eventError } = await supabase.from("eventi").insert({
        pratica_id: practiceId,
        tipo: "external_service_error",
        dettaglio: { source, message },
      });
      if (eventError) {
        console.error("Unable to create practice error event", eventError.message);
      }
    }
  } catch (reportingError) {
    console.error("Unable to persist external-service error", reportingError);
  }
}
