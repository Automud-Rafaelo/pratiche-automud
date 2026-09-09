"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  APPOINTMENT_SLOTS,
  PICKUP_LOCATIONS,
  getAppointmentPreferenceOptions,
  isValidIban,
  isValidItalianTaxCode,
  isValidPhone,
  normalizeUppercaseValue,
  normalizeVehiclePlate,
} from "@/lib/config/business-rules";
import { findNearbyAgencies } from "@/lib/customer/agencies";
import {
  loadCustomerPractice,
  recordCustomerEvent,
  recordCustomerEventOnce,
  updateCustomerPractice,
} from "@/lib/customer/data";
import {
  getCustomerNavigationContext,
  getVisibleCustomerScreen,
} from "@/lib/customer/flow";
import {
  getNextCustomerScreen,
  type CustomerNavigationContext,
  type CustomerScreenId,
} from "@/lib/customer/navigation";
import { verifyPlaceSelectionProof } from "@/lib/customer/place-selection";
import { calculateScreenDurationMs } from "@/lib/customer/screen-timing";

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
  return {
    token,
    ...context,
    navigation: getCustomerNavigationContext(
      context.practice,
      context.events,
    ),
  };
}

async function finishAction(
  token: string,
  screen: CustomerScreenId,
  navigation: CustomerNavigationContext,
): Promise<never> {
  const context = await loadCustomerPractice(token);
  if (context) {
    await recordCustomerEvent(context.practice.id, "schermata_completata", {
      schermata: screen,
      durata_ms: calculateScreenDurationMs(context.events, screen),
    });
  }
  revalidatePath(`/p/${token}`);
  const nextScreen = getNextCustomerScreen(screen, navigation);
  redirect(nextScreen ? `/p/${token}?view=${nextScreen}#top` : `/p/${token}`);
}

function invalidAction(
  token: string,
  screen: CustomerScreenId,
  error = "invalid",
): never {
  redirect(`/p/${token}?view=${screen}&error=${error}#top`);
}

export async function startCustomerFlowAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "welcome",
  );
  if (practice.status === "creata") {
    await updateCustomerPractice(practice.id, { status: "step1_dati" });
    await recordCustomerEventOnce(practice.id, "link_aperto");
  }
  return finishAction(token, "welcome", navigation);
}

export async function saveOwnerAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "owner",
  );
  const value = formData.get("is_owner");
  if (value !== "yes" && value !== "no") invalidAction(token, "owner");
  await updateCustomerPractice(practice.id, {
    is_proprietario: value === "yes",
  });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "is_proprietario",
  });
  return finishAction(token, "owner", {
    ...navigation,
    isOwner: value === "yes",
  });
}

export async function acknowledgeOwnerNoticeAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "owner_notice",
  );
  await recordCustomerEventOnce(
    practice.id,
    "proprietario_assente_avviso_visto",
  );
  return finishAction(token, "owner_notice", navigation);
}

async function saveTextField(
  formData: FormData,
  screen: CustomerScreenId,
  field: string,
  normalize: (value: string) => string = (value) => value.trim(),
  validate: (value: string) => boolean = (value) => value.length > 0,
) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    screen,
  );
  const rawValue = formData.get(field);
  const value = typeof rawValue === "string" ? normalize(rawValue) : "";
  if (!validate(value)) invalidAction(token, screen);
  await updateCustomerPractice(practice.id, { [field]: value });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: field,
  });
  return finishAction(token, screen, navigation);
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
  const { token, practice, navigation } = await getActionContext(
    formData,
    "plate",
  );
  const decision = formData.get("plate_confirmation");
  if (decision !== "confirm" && decision !== "dispute") {
    invalidAction(token, "plate");
  }

  if (decision === "dispute") {
    await recordCustomerEvent(
      practice.id,
      "targa_contestata_richiesta",
      { targa_operatore: practice.targa },
    );
    return finishAction(token, "plate", {
      ...navigation,
      hasDisputedPlate: true,
    });
  } else {
    await recordCustomerEvent(practice.id, "targa_confermata");
    await updateCustomerPractice(practice.id, {
      targa_cliente: null,
      ...(practice.status === "step1_dati"
        ? { status: "step2_agenzia" }
        : {}),
    });
    if (practice.status === "step1_dati") {
      await recordCustomerEvent(practice.id, "stato_aggiornato", {
        stato: "step2_agenzia",
      });
    }
    return finishAction(token, "plate", {
      ...navigation,
      hasDisputedPlate: false,
    });
  }
}

export async function saveCustomerPlateAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "customer_plate",
  );
  const rawPlate = formData.get("targa_cliente");
  const customerPlate =
    typeof rawPlate === "string" ? normalizeVehiclePlate(rawPlate) : "";
  if (!customerPlate) invalidAction(token, "customer_plate");

  await recordCustomerEvent(practice.id, "targa_contestata", {
    targa_operatore: practice.targa,
    targa_cliente: customerPlate,
  });
  await updateCustomerPractice(practice.id, {
    targa_cliente: customerPlate,
    ...(practice.status === "step1_dati"
      ? { status: "step2_agenzia" }
      : {}),
  });
  if (practice.status === "step1_dati") {
    await recordCustomerEvent(practice.id, "stato_aggiornato", {
      stato: "step2_agenzia",
    });
  }
  return finishAction(token, "customer_plate", {
    ...navigation,
    hasDisputedPlate: true,
  });
}

export async function saveAgencyLocationAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "agency_location",
  );
  const selectionMode = formData.get("selection_mode");
  let values: {
    ricerca_indirizzo: string;
    ricerca_place_id: string | null;
    ricerca_lat: number | null;
    ricerca_lng: number | null;
  };

  if (selectionMode === "place") {
    const proof = formData.get("place_proof");
    const place =
      typeof proof === "string"
        ? verifyPlaceSelectionProof(proof, practice.id)
        : null;
    if (!place) invalidAction(token, "agency_location");
    values = {
      ricerca_indirizzo: place.formattedAddress,
      ricerca_place_id: place.placeId,
      ricerca_lat: place.lat,
      ricerca_lng: place.lng,
    };
  } else if (selectionMode === "manual") {
    const manualAddress = formData.get("manual_address");
    if (typeof manualAddress !== "string" || !manualAddress.trim()) {
      invalidAction(token, "agency_location");
    }
    values = {
      ricerca_indirizzo: manualAddress.trim(),
      ricerca_place_id: null,
      ricerca_lat: null,
      ricerca_lng: null,
    };
  } else {
    invalidAction(token, "agency_location");
  }

  await updateCustomerPractice(practice.id, {
    ...values,
    agenzia_id: null,
  });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "ricerca_indirizzo",
  });
  await recordCustomerEvent(practice.id, "posizione_ricerca_salvata", {
    indirizzo: values.ricerca_indirizzo,
    origine: selectionMode,
  });
  return finishAction(token, "agency_location", {
    ...navigation,
    useAgencyFallback: values.ricerca_lat === null,
  });
}

export async function saveCoownershipAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "coownership",
  );
  const value = formData.get("coownership");
  if (value !== "yes" && value !== "no") {
    invalidAction(token, "coownership");
  }
  await updateCustomerPractice(practice.id, { cointestata: value === "yes" });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "cointestata",
  });
  return finishAction(token, "coownership", {
    ...navigation,
    isCoOwned: value === "yes",
  });
}

export async function acknowledgeCoownershipNoticeAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "coownership_notice",
  );
  await recordCustomerEventOnce(practice.id, "cointestatari_avviso_visto");
  return finishAction(token, "coownership_notice", navigation);
}

export async function saveKeysAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "keys",
  );
  const value = formData.get("both_keys");
  if (value !== "yes" && value !== "no") invalidAction(token, "keys");
  await updateCustomerPractice(practice.id, { due_chiavi: value === "yes" });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "due_chiavi",
  });
  return finishAction(token, "keys", navigation);
}

export async function saveAgencyAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "agency",
  );
  const agencyId = formData.get("agency_id");
  if (
    typeof agencyId !== "string" ||
    practice.ricerca_lat === null ||
    practice.ricerca_lng === null
  ) {
    invalidAction(token, "agency");
  }

  const result = await findNearbyAgencies(practice.id, {
    lat: practice.ricerca_lat,
    lng: practice.ricerca_lng,
  });
  if (!result.ok) {
    await recordCustomerEvent(practice.id, "ricerca_agenzie_fallita", {
      indirizzo: practice.ricerca_indirizzo,
      errore: result.error,
    });
    revalidatePath(`/p/${token}`);
    redirect(`/p/${token}?view=agency_fallback#top`);
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
  return finishAction(token, "agency", navigation);
}

export async function continueWithoutAgencyAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
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
  return finishAction(token, "agency_fallback", navigation);
}

export async function saveOwnerAvailabilityAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
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
  return finishAction(token, "owner_availability", {
    ...navigation,
    knowsOwnerAvailability: value === "yes",
  });
}

export async function acknowledgeAvailabilityNoticeAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "availability_notice",
  );
  await updateCustomerPractice(practice.id, { status: "step4_ritiro" });
  await recordCustomerEvent(practice.id, "stato_aggiornato", {
    stato: "step4_ritiro",
  });
  return finishAction(token, "availability_notice", navigation);
}

export async function saveAppointmentPreferenceAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "appointment",
  );
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
  return finishAction(token, "appointment", navigation);
}

export async function savePickupLocationAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
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
  const locationChanged = practice.ubicazione_auto !== location;
  await updateCustomerPractice(practice.id, {
    ubicazione_auto: location,
    ...(locationChanged
      ? {
          indirizzo_ritiro: null,
          ritiro_nome_attivita: null,
          ritiro_place_id: null,
          ritiro_lat: null,
          ritiro_lng: null,
        }
      : {}),
  });
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "ubicazione_auto",
  });
  return finishAction(token, "pickup_location", navigation);
}

export async function savePickupAddressAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "pickup_address",
  );
  if (!practice.ubicazione_auto) invalidAction(token, "pickup_location");

  const selectionMode = formData.get("selection_mode");
  let values: {
    indirizzo_ritiro: string;
    ritiro_nome_attivita: string | null;
    ritiro_place_id: string | null;
    ritiro_lat: number | null;
    ritiro_lng: number | null;
  };
  if (selectionMode === "place") {
    const proof = formData.get("place_proof");
    const place =
      typeof proof === "string"
        ? verifyPlaceSelectionProof(proof, practice.id)
        : null;
    if (!place) invalidAction(token, "pickup_address");
    values = {
      indirizzo_ritiro: place.formattedAddress,
      ritiro_nome_attivita:
        practice.ubicazione_auto === "casa"
          ? null
          : place.displayName.trim() || null,
      ritiro_place_id: place.placeId,
      ritiro_lat: place.lat,
      ritiro_lng: place.lng,
    };
  } else if (selectionMode === "manual") {
    const manualAddress = formData.get("manual_address");
    if (typeof manualAddress !== "string" || !manualAddress.trim()) {
      invalidAction(token, "pickup_address");
    }
    values = {
      indirizzo_ritiro: manualAddress.trim(),
      ritiro_nome_attivita: null,
      ritiro_place_id: null,
      ritiro_lat: null,
      ritiro_lng: null,
    };
  } else {
    invalidAction(token, "pickup_address");
  }

  await updateCustomerPractice(practice.id, values);
  await recordCustomerEvent(practice.id, "dato_cliente_aggiornato", {
    campo: "indirizzo_ritiro",
  });
  return finishAction(token, "pickup_address", navigation);
}

export async function savePickupPhoneAction(formData: FormData) {
  const { token, practice, navigation } = await getActionContext(
    formData,
    "pickup_phone",
  );
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
  return finishAction(token, "pickup_phone", navigation);
}
