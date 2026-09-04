"use server";

import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin/auth";
import { recordAdminEvent } from "@/lib/admin/events";
import {
  BUSINESS_RULES,
  normalizeVehiclePlate,
  PRACTICE_TYPES,
} from "@/lib/config/business-rules";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function createPracticeAction(formData: FormData) {
  await requireAdminSession();

  const type = formData.get("tipo_pratica");
  const priceRaw = formData.get("prezzo_concordato");
  const plateRaw = formData.get("targa");
  const make = formData.get("marca");
  const model = formData.get("modello");

  if (
    typeof type !== "string" ||
    !PRACTICE_TYPES.includes(type as (typeof PRACTICE_TYPES)[number]) ||
    typeof priceRaw !== "string" ||
    typeof plateRaw !== "string" ||
    typeof make !== "string" ||
    typeof model !== "string"
  ) {
    redirect("/admin/pratiche/nuova?error=invalid");
  }

  const price = Number(priceRaw.replace(",", "."));
  const plate = normalizeVehiclePlate(plateRaw);
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    !plate ||
    !make.trim() ||
    !model.trim()
  ) {
    redirect("/admin/pratiche/nuova?error=invalid");
  }

  const plateWarning =
    !BUSINESS_RULES.validation.modernItalianVehiclePlatePattern.test(plate);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("pratiche")
    .insert({
      tipo_pratica: type,
      prezzo_concordato: price,
      targa: plate,
      marca: make.trim(),
      modello: model.trim(),
    })
    .select("id")
    .single();

  if (error) {
    const message = `Supabase: creazione pratica fallita: ${error.message}`;
    await reportExternalServiceError({ source: "Supabase", message });
    redirect(
      `/admin/pratiche/nuova?error=service&cause=${encodeURIComponent(message)}`,
    );
  }

  await recordAdminEvent(data.id, "pratica_creata", {
    targa_formato_moderno: !plateWarning,
  });

  const warning = plateWarning ? "&warning=plate" : "";
  redirect(`/admin/pratiche/nuova?created=${data.id}${warning}`);
}
