"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { importAgencies } from "@/lib/admin/agency-import";
import { requireAdminSession } from "@/lib/admin/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function importAgenciesAction() {
  await requireAdminSession();
  const summary = await importAgencies();
  revalidatePath("/admin/import-agenzie");
  const params = new URLSearchParams({
    imported: "1",
    rows: String(summary.rows),
    ok: String(summary.ok),
    not_found: String(summary.notFound),
    pending: String(summary.pending),
    places_errors: String(summary.placesErrors),
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
    throw new Error(`Unable to load agency: ${loadError.message}`);
  }

  if (activate && !data.telefono?.trim()) {
    redirect("/admin/import-agenzie?toggle_error=phone");
  }

  const { error } = await supabase
    .from("agenzie")
    .update({ attiva: activate })
    .eq("id", agencyId);

  if (error) {
    throw new Error(`Unable to update agency: ${error.message}`);
  }

  revalidatePath("/admin/import-agenzie");
  redirect("/admin/import-agenzie?toggle_saved=1");
}
