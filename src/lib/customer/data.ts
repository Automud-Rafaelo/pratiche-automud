import "server-only";

import type { EventRow, PracticeRow } from "@/lib/admin/types";
import { BUSINESS_RULES } from "@/lib/config/business-rules";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export function isPlausibleCustomerToken(token: string) {
  return (
    token.length >= BUSINESS_RULES.customerToken.minimumLength &&
    BUSINESS_RULES.customerToken.urlSafePattern.test(token)
  );
}

export async function loadCustomerPractice(token: string) {
  if (!isPlausibleCustomerToken(token)) return null;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("pratiche")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    await reportExternalServiceError({
      source: "Supabase",
      message: `Lettura pratica cliente fallita: ${error.message}`,
    });
    throw new Error(`Unable to load customer practice: ${error.message}`);
  }
  if (!data) return null;

  const practice = data as PracticeRow;
  const { data: eventData, error: eventError } = await supabase
    .from("eventi")
    .select("*")
    .eq("pratica_id", practice.id)
    .order("created_at", { ascending: false });

  if (eventError) {
    await reportExternalServiceError({
      source: "Supabase",
      message: `Lettura eventi cliente fallita: ${eventError.message}`,
      practiceId: practice.id,
    });
    throw new Error(`Unable to load customer events: ${eventError.message}`);
  }

  return { practice, events: (eventData ?? []) as EventRow[] };
}

export async function updateCustomerPractice(
  practiceId: string,
  values: Record<string, unknown>,
) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("pratiche")
    .update(values)
    .eq("id", practiceId);

  if (error) {
    await reportExternalServiceError({
      source: "Supabase",
      message: `Salvataggio dati cliente fallito: ${error.message}`,
      practiceId,
    });
    throw new Error(`Unable to save customer practice: ${error.message}`);
  }
}

export async function recordCustomerEvent(
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
      message: `Registrazione evento cliente fallita: ${error.message}`,
      practiceId,
    });
    throw new Error(`Unable to record customer event: ${error.message}`);
  }
}

export async function recordCustomerEventOnce(
  practiceId: string,
  type: string,
  detail: Record<string, unknown> = {},
  matchDetail?: { key: string; value: string },
) {
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("eventi")
    .select("id")
    .eq("pratica_id", practiceId)
    .eq("tipo", type)
    .limit(1);
  if (matchDetail) {
    query = query.eq(`dettaglio->>${matchDetail.key}`, matchDetail.value);
  }
  const { data, error } = await query;

  if (error) {
    await reportExternalServiceError({
      source: "Supabase",
      message: `Controllo evento cliente fallito: ${error.message}`,
      practiceId,
    });
    throw new Error(`Unable to inspect customer event: ${error.message}`);
  }
  if ((data ?? []).length > 0) return;
  await recordCustomerEvent(practiceId, type, detail);
}
