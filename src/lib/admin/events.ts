import "server-only";

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
    throw new Error(`Unable to record event: ${error.message}`);
  }
}
