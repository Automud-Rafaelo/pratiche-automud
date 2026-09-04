"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin/auth";
import { recordAdminEvent } from "@/lib/admin/events";
import {
  APPOINTMENT_SLOTS,
  VERIFICATION_FIELDS,
  type VerificationField,
} from "@/lib/config/business-rules";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function getPracticeId(formData: FormData) {
  const value = formData.get("practice_id");
  if (typeof value !== "string" || !value) {
    throw new Error("Missing practice id.");
  }
  return value;
}

function redirectWithMessage(practiceId: string, message: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/pratiche/${practiceId}`);
  redirect(`/admin/pratiche/${practiceId}?notice=${message}`);
}

function parseVerification(value: FormDataEntryValue | null) {
  if (value === "ok") return false;
  if (value === "anomaly") return true;
  return null;
}

export async function saveVerificationsAction(formData: FormData) {
  await requireAdminSession();
  const practiceId = getPracticeId(formData);
  const updates = Object.fromEntries(
    VERIFICATION_FIELDS.map((field) => [
      field,
      parseVerification(formData.get(field)),
    ]),
  ) as Record<VerificationField, boolean | null>;
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("pratiche")
    .update(updates)
    .eq("id", practiceId);

  if (error) {
    throw new Error(`Unable to save verifications: ${error.message}`);
  }

  await recordAdminEvent(practiceId, "verifiche_aggiornate");
  redirectWithMessage(practiceId, "verifications_saved");
}

export async function completeVerificationsAction(formData: FormData) {
  await requireAdminSession();
  const practiceId = getPracticeId(formData);
  const supabase = createAdminSupabaseClient();
  const { data, error: loadError } = await supabase
    .from("pratiche")
    .select(VERIFICATION_FIELDS.join(","))
    .eq("id", practiceId)
    .single();

  if (loadError) {
    throw new Error(`Unable to load verifications: ${loadError.message}`);
  }

  const verificationData = data as unknown as Record<
    VerificationField,
    boolean | null
  >;
  const allCompleted = VERIFICATION_FIELDS.every(
    (field) => typeof verificationData[field] === "boolean",
  );
  if (!allCompleted) {
    redirectWithMessage(practiceId, "verifications_incomplete");
  }

  const completedAt = new Date().toISOString();
  const { error } = await supabase
    .from("pratiche")
    .update({ verifiche_completate_at: completedAt })
    .eq("id", practiceId);

  if (error) {
    throw new Error(`Unable to complete verifications: ${error.message}`);
  }

  await recordAdminEvent(practiceId, "verifiche_completate");
  redirectWithMessage(practiceId, "verifications_completed");
}

export async function saveAppointmentAction(formData: FormData) {
  await requireAdminSession();
  const practiceId = getPracticeId(formData);
  const dateValue = formData.get("appuntamento_confermato_data");
  const slotValue = formData.get("appuntamento_confermato_fascia");
  const date = typeof dateValue === "string" && dateValue ? dateValue : null;
  const slot =
    typeof slotValue === "string" &&
    APPOINTMENT_SLOTS.includes(
      slotValue as (typeof APPOINTMENT_SLOTS)[number],
    )
      ? slotValue
      : null;

  if ((date && !slot) || (!date && slot)) {
    redirectWithMessage(practiceId, "appointment_invalid");
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("pratiche")
    .update({
      appuntamento_confermato_data: date,
      appuntamento_confermato_fascia: slot,
    })
    .eq("id", practiceId);

  if (error) {
    throw new Error(`Unable to save appointment: ${error.message}`);
  }

  await recordAdminEvent(practiceId, "appuntamento_aggiornato", {
    confermato: Boolean(date),
  });
  redirectWithMessage(practiceId, "appointment_saved");
}

export async function saveNotesAction(formData: FormData) {
  await requireAdminSession();
  const practiceId = getPracticeId(formData);
  const notesValue = formData.get("note_operatore");
  const notes =
    typeof notesValue === "string" && notesValue.trim()
      ? notesValue.trim()
      : null;
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("pratiche")
    .update({ note_operatore: notes })
    .eq("id", practiceId);

  if (error) {
    throw new Error(`Unable to save notes: ${error.message}`);
  }

  await recordAdminEvent(practiceId, "note_operatore_aggiornate");
  redirectWithMessage(practiceId, "notes_saved");
}
