import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type OperatorAlert = {
  source: string;
  message: string;
  context?: Record<string, string>;
  practiceId?: string;
};

async function persistOperatorAlert({
  source,
  message,
  context = {},
  practiceId,
}: OperatorAlert) {
  const supabase = createAdminSupabaseClient();
  const { error: alertError } = await supabase.from("operator_alerts").insert({
    pratica_id: practiceId ?? null,
    source,
    message,
    context: practiceId ? { ...context, practice_id: practiceId } : context,
  });

  if (alertError) {
    console.error("Unable to create operator alert", alertError.message);
  }
}

export async function reportOperatorAlert(alert: OperatorAlert) {
  console.warn(`[${alert.source}] ${alert.message}`, alert.context ?? {});
  try {
    await persistOperatorAlert(alert);
  } catch (reportingError) {
    console.error("Unable to persist operator alert", reportingError);
  }
}

export async function reportExternalServiceError({
  source,
  message,
  context = {},
  practiceId,
}: OperatorAlert) {
  console.error(`[${source}] ${message}`, context);

  try {
    await persistOperatorAlert({ source, message, context, practiceId });

    if (practiceId) {
      const supabase = createAdminSupabaseClient();
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
