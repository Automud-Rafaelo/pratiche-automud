"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  APPOINTMENT_SLOTS,
  PICKUP_LOCATIONS,
  getAppointmentPreferenceOptions,
  isValidIban,
  isValidItalianPostalCode,
  isValidItalianTaxCode,
  isValidPhone,
  normalizeUppercaseValue,
  type CustomerScreenId,
} from "@/lib/config/business-rules";
import { findNearbyAgencies } from "@/lib/customer/agencies";
import {
  loadCustomerPractice,
  recordCustomerEvent,
  recordCustomerEventOnce,
  updateCustomerPractice,
} from "@/lib/customer/data";
import { getVisibleCustomerScreen } from "@/lib/customer/flow";

async function getActionContext(formData: FormData, expected: CustomerScreenId) {
  const token = formData.get("token");
  const submittedScreen = formData.get("screen");
  if (typeof token !== "string" || submittedScreen !== expected) {
    throw new Error("Invalid customer action context.");
  }

  const context = await loadCustomerPractice(token);
  if (!context) redirect(`/p/${token}`);
  const allowedScreen = getVisibleCustomerScreen(
    context.practice,
    context.events,
    expected,
  );
  if (allowedScreen !== expected) redirect(`/p/${token}`);
  return { token, ...context };
}

function finishAction(token: string): never {
  revalidatePath(`/p/${token}`);
  redirect(`/p/${token}`);
}

function invalidAction(token: string, screen: CustomerScreenId): never {
  redirect(`/p/${token}?view=${screen}&error=invalid`);
}

export async function startCustomerFlowAction(formData: FormData) {
  const { token, practice } = await getActionContext(formData, "welcome");
  if (practice.status === "creata") {
    await updateCustomerPractice(practice.id, { status: "step1_dati" });
    await recordCustomerEventOnce(practice.id, "link_aperto");
  }
  finishAction(token);
}

export async function saveOwnerAction(formData: FormData) {
  const { token, practice } = await getActionContext(formData, "owner");
  const value = formData.get("is_owner");
  if (value !== "yes" && value !== "no") invalidAction(token, "owner");
  await updateCustomerPractice(practice.id, {
    is_proprietario: value === "yes",
  });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "is_proprietario",
  });
  finishAction(token);
}

export async function acknowledgeOwnerNoticeAction(formData: FormData) {
  const { token, practice } = await getActionContext(formData, "owner_notice");
  await recordCustomerEventOnce(
    practice.id,
    "proprietario_assente_avviso_visto",
  );
  finishAction(token);
}

async function saveTextField(
  formData: FormData,
  screen: CustomerScreenId,
  field: string,
  normalize: (value: string) => string = (value) => value.trim(),
  validate: (value: string) => boolean = (value) => value.length > 0,
) {
  const { token, practice } = await getActionContext(formData, screen);
  const rawValue = formData.get(field);
  const value = typeof rawValue === "string" ? normalize(rawValue) : "";
  if (!validate(value)) invalidAction(token, screen);
  await updateCustomerPractice(practice.id, { [field]: value });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: field,
  });
  finishAction(token);
}

export async function saveFirstNameAction(formData: FormData) {
  return saveTextField(formData, "first_name", "nome");
}

export async function saveLastNameAction(formData: FormData) {
  return saveTextField(formData, "last_name", "cognome");
}

export async function saveTaxCodeAction(formData: FormData) {
  return saveTextField(
    formData,
    "tax_code",
    "codice_fiscale",
    normalizeUppercaseValue,
    isValidItalianTaxCode,
  );
}

export async function saveIbanAction(formData: FormData) {
  return saveTextField(
    formData,
    "iban",
    "iban",
    normalizeUppercaseValue,
    isValidIban,
  );
}

export async function savePlateConfirmationAction(formData: FormData) {
  const { token, practice } = await getActionContext(formData, "plate");
  const decision = formData.get("plate_confirmation");
  if (decision !== "confirm" && decision !== "dispute") {
    invalidAction(token, "plate");
  }

  if (decision === "dispute") {
    await recordCustomerEvent(practice.id, "targa_contestata");
  } else {
    await recordCustomerEvent(practice.id, "targa_confermata");
    if (practice.status === "step1_dati") {
      await updateCustomerPractice(practice.id, { status: "step2_agenzia" });
      await recordCustomerEvent(practice.id, "stato_aggiornato", {
        stato: "step2_agenzia",
      });
    }
  }
  finishAction(token);
}

export async function acknowledgePlateNoticeAction(formData: FormData) {
  const { token, practice } = await getActionContext(formData, "plate_notice");
  await recordCustomerEventOnce(
    practice.id,
    "targa_contestata_avviso_visto",
  );
  if (practice.status === "step1_dati") {
    await updateCustomerPractice(practice.id, { status: "step2_agenzia" });
    await recordCustomerEvent(practice.id, "stato_aggiornato", {
      stato: "step2_agenzia",
    });
  }
  finishAction(token);
}

export async function savePostalCodeAction(formData: FormData) {
  const { token, practice } = await getActionContext(formData, "postal_code");
  const rawValue = formData.get("cap");
  const postalCode = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!isValidItalianPostalCode(postalCode)) {
    invalidAction(token, "postal_code");
  }
  await updateCustomerPractice(practice.id, {
    cap: postalCode,
    agenzia_id: postalCode === practice.cap ? practice.agenzia_id : null,
    status:
      postalCode === practice.cap ? practice.status : "step2_agenzia",
  });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "cap",
  });
  finishAction(token);
}

export async function saveCoownershipAction(formData: FormData) {
  const { token, practice } = await getActionContext(formData, "coownership");
  const value = formData.get("coownership");
  if (value !== "yes" && value !== "no") {
    invalidAction(token, "coownership");
  }
  await updateCustomerPractice(practice.id, { cointestata: value === "yes" });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "cointestata",
  });
  finishAction(token);
}

export async function acknowledgeCoownershipNoticeAction(formData: FormData) {
  const { token, practice } = await getActionContext(
    formData,
    "coownership_notice",
  );
  await recordCustomerEventOnce(practice.id, "cointestatari_avviso_visto");
  finishAction(token);
}

export async function saveKeysAction(formData: FormData) {
  const { token, practice } = await getActionContext(formData, "keys");
  const value = formData.get("both_keys");
  if (value !== "yes" && value !== "no") invalidAction(token, "keys");
  await updateCustomerPractice(practice.id, { due_chiavi: value === "yes" });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "due_chiavi",
  });
  finishAction(token);
}

export async function saveAgencyAction(formData: FormData) {
  const { token, practice } = await getActionContext(formData, "agency");
  const agencyId = formData.get("agency_id");
  if (typeof agencyId !== "string" || !practice.cap) {
    invalidAction(token, "agency");
  }

  const result = await findNearbyAgencies(practice.id, practice.cap);
  if (!result.ok) {
    await recordCustomerEventOnce(
      practice.id,
      "geocoding_fallito",
      { cap: practice.cap, errore: result.error },
      { key: "cap", value: practice.cap },
    );
    finishAction(token);
  }
  if (!result.agencies.some((agency) => agency.id === agencyId)) {
    invalidAction(token, "agency");
  }

  await updateCustomerPractice(practice.id, {
    agenzia_id: agencyId,
    status: "step3_appuntamento",
  });
  await recordCustomerEvent(practice.id, "agenzia_scelta");
  await recordCustomerEvent(practice.id, "stato_aggiornato", {
    stato: "step3_appuntamento",
  });
  finishAction(token);
}

export async function continueWithoutAgencyAction(formData: FormData) {
  const { token, practice } = await getActionContext(
    formData,
    "agency_fallback",
  );
  await updateCustomerPractice(practice.id, {
    agenzia_id: null,
    status: "step3_appuntamento",
  });
  await recordCustomerEvent(practice.id, "stato_aggiornato", {
    stato: "step3_appuntamento",
  });
  finishAction(token);
}

export async function saveOwnerAvailabilityAction(formData: FormData) {
  const { token, practice } = await getActionContext(
    formData,
    "owner_availability",
  );
  const value = formData.get("knows_availability");
  if (value !== "yes" && value !== "no") {
    invalidAction(token, "owner_availability");
  }
  await updateCustomerPractice(practice.id, {
    conosce_orari_proprietario: value === "yes",
    preferenza_data: value === "no" ? null : practice.preferenza_data,
    preferenza_fascia: value === "no" ? null : practice.preferenza_fascia,
  });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "conosce_orari_proprietario",
  });
  finishAction(token);
}

export async function acknowledgeAvailabilityNoticeAction(formData: FormData) {
  const { token, practice } = await getActionContext(
    formData,
    "availability_notice",
  );
  await updateCustomerPractice(practice.id, { status: "step4_ritiro" });
  await recordCustomerEvent(practice.id, "stato_aggiornato", {
    stato: "step4_ritiro",
  });
  finishAction(token);
}

export async function saveAppointmentPreferenceAction(formData: FormData) {
  const { token, practice } = await getActionContext(formData, "appointment");
  const date = formData.get("preference_date");
  const slot = formData.get("preference_slot");
  const options = getAppointmentPreferenceOptions();
  const selectedDay = options.find((option) => option.date === date);
  if (
    typeof date !== "string" ||
    typeof slot !== "string" ||
    !APPOINTMENT_SLOTS.includes(slot as (typeof APPOINTMENT_SLOTS)[number]) ||
    !selectedDay?.slots.includes(slot as (typeof APPOINTMENT_SLOTS)[number])
  ) {
    invalidAction(token, "appointment");
  }

  await updateCustomerPractice(practice.id, {
    preferenza_data: date,
    preferenza_fascia: slot,
    status: "step4_ritiro",
  });
  await recordCustomerEvent(practice.id, "preferenza_appuntamento_salvata");
  await recordCustomerEvent(practice.id, "stato_aggiornato", {
    stato: "step4_ritiro",
  });
  finishAction(token);
}

export async function savePickupLocationAction(formData: FormData) {
  const { token, practice } = await getActionContext(
    formData,
    "pickup_location",
  );
  const location = formData.get("pickup_location");
  if (
    typeof location !== "string" ||
    !PICKUP_LOCATIONS.includes(location as (typeof PICKUP_LOCATIONS)[number])
  ) {
    invalidAction(token, "pickup_location");
  }
  await updateCustomerPractice(practice.id, { ubicazione_auto: location });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "ubicazione_auto",
  });
  finishAction(token);
}

export async function savePickupAddressAction(formData: FormData) {
  return saveTextField(
    formData,
    "pickup_address",
    "indirizzo_ritiro",
  );
}

export async function savePickupPhoneAction(formData: FormData) {
  const { token, practice } = await getActionContext(formData, "pickup_phone");
  const rawPhone = formData.get("telefono_ritiro");
  const phone = typeof rawPhone === "string" ? rawPhone.trim() : "";
  if (!isValidPhone(phone)) {
    invalidAction(token, "pickup_phone");
  }
  await updateCustomerPractice(practice.id, {
    telefono_ritiro: phone,
    status: "completata",
  });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "telefono_ritiro",
  });
  await recordCustomerEvent(practice.id, "stato_aggiornato", {
    stato: "completata",
  });
  finishAction(token);
}
