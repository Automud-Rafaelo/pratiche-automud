import "server-only";

import { reportExternalServiceError } from "@/lib/external-service-errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function recordAdminEvent(
  practiceId: string,
  type: string,
  detail: Record<string, unknown> = {},
) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("eventi").insert({
    pratica_id: practiceId,
    tipo: type,
    dettaglio: detail,
  });

  if (error) {
    await reportExternalServiceError({
      source: "Supabase",
      message: `Registrazione evento operatore fallita: ${error.message}`,
      practiceId,
    });
  }
}
