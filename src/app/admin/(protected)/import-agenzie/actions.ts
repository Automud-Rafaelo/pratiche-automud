"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  importAgencies,
  type ImportSummary,
} from "@/lib/admin/agency-import";
import { requireAdminSession } from "@/lib/admin/auth";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function importAgenciesAction() {
  await requireAdminSession();
  let summary: ImportSummary;
  try {
    summary = await importAgencies();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    await reportExternalServiceError({ source: "Import agenzie", message });
    redirect(
      `/admin/import-agenzie?run_error=${encodeURIComponent(message)}`,
    );
  }
  revalidatePath("/admin/import-agenzie");
  const params = new URLSearchParams({
    imported: "1",
    processed: String(summary.processed),
    pending_before: String(summary.pendingBefore),
    pending_after: String(summary.pendingAfter),
    missing_key: summary.missingApiKey ? "1" : "0",
  });
  redirect(`/admin/import-agenzie?${params.toString()}`);
}

export async function toggleAgencyAction(formData: FormData) {
  await requireAdminSession();
  const agencyId = formData.get("agency_id");
  const activate = formData.get("activate") === "true";

  if (typeof agencyId !== "string" || !agencyId) {
    throw new Error("Missing agency id.");
  }

  const supabase = createAdminSupabaseClient();
  const { data, error: loadError } = await supabase
    .from("agenzie")
    .select("telefono")
    .eq("id", agencyId)
    .single();

  if (loadError) {
    const message = `Supabase: lettura agenzia fallita: ${loadError.message}`;
    await reportExternalServiceError({ source: "Supabase", message });
    redirect(`/admin/import-agenzie?toggle_error=${encodeURIComponent(message)}`);
  }

  if (activate && !data.telefono?.trim()) {
    redirect("/admin/import-agenzie?toggle_error=phone");
  }

  const { error } = await supabase
    .from("agenzie")
    .update({ attiva: activate })
    .eq("id", agencyId);

  if (error) {
    const message = `Supabase: aggiornamento agenzia fallito: ${error.message}`;
    await reportExternalServiceError({ source: "Supabase", message });
    redirect(`/admin/import-agenzie?toggle_error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/import-agenzie");
  redirect("/admin/import-agenzie?toggle_saved=1");
}
