"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deleteAdminSession, requireAdminSession } from "@/lib/admin/auth";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function logoutAction() {
  await requireAdminSession();
  await deleteAdminSession();
  redirect("/admin/login");
}

export async function resolveOperatorAlertAction(formData: FormData) {
  await requireAdminSession();
  const alertId = formData.get("alert_id");
  if (typeof alertId !== "string" || !alertId) {
    throw new Error("Missing operator alert id.");
  }
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("operator_alerts")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", alertId);
  if (error) {
    const message = `Supabase: chiusura avviso fallita: ${error.message}`;
    await reportExternalServiceError({ source: "Supabase", message });
    redirect(`/admin?service_error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin");
}
