import "server-only";

import type { EventRow, PracticeRow } from "@/lib/admin/types";
import type { CustomerScreenId, PracticeStatus } from "@/lib/config/business-rules";

const statusRank: Record<PracticeStatus, number> = {
  creata: 0,
  step1_dati: 1,
  step2_agenzia: 2,
  step3_appuntamento: 3,
  step4_ritiro: 4,
  completata: 5,
};

const screenStage: Partial<Record<CustomerScreenId, PracticeStatus>> = {
  owner: "step1_dati",
  owner_notice: "step1_dati",
  first_name: "step1_dati",
  last_name: "step1_dati",
  tax_code: "step1_dati",
  iban: "step1_dati",
  plate: "step1_dati",
  plate_notice: "step1_dati",
  postal_code: "step2_agenzia",
  coownership: "step2_agenzia",
  coownership_notice: "step2_agenzia",
  keys: "step2_agenzia",
  agency: "step2_agenzia",
  agency_fallback: "step2_agenzia",
  owner_availability: "step3_appuntamento",
  availability_notice: "step3_appuntamento",
  appointment: "step3_appuntamento",
  pickup_location: "step4_ritiro",
  pickup_address: "step4_ritiro",
  pickup_phone: "step4_ritiro",
};

export function findEvent(
  events: EventRow[],
  type: string,
  predicate?: (event: EventRow) => boolean,
) {
  return events.find(
    (event) => event.tipo === type && (!predicate || predicate(event)),
  );
}

function hasCurrentPostalCodeEvent(
  events: EventRow[],
  type: string,
  postalCode: string | null,
) {
  return Boolean(
    postalCode &&
      findEvent(events, type, (event) => event.dettaglio.cap === postalCode),
  );
}

export function resolveCustomerScreen(
  practice: PracticeRow,
  events: EventRow[],
): CustomerScreenId {
  if (practice.status === "creata") return "welcome";
  if (practice.status === "completata") return "complete";

  if (practice.status === "step1_dati") {
    if (practice.is_proprietario === null) return "owner";
    if (
      practice.is_proprietario === false &&
      !findEvent(events, "proprietario_assente_avviso_visto")
    ) {
      return "owner_notice";
    }
    if (!practice.nome) return "first_name";
    if (!practice.cognome) return "last_name";
    if (!practice.codice_fiscale) return "tax_code";
    if (!practice.iban) return "iban";

    const plateDisputed = findEvent(events, "targa_contestata");
    const plateConfirmed = findEvent(events, "targa_confermata");
    if (!plateDisputed && !plateConfirmed) return "plate";
    if (
      plateDisputed &&
      !findEvent(events, "targa_contestata_avviso_visto")
    ) {
      return "plate_notice";
    }
    return "plate";
  }

  if (practice.status === "step2_agenzia") {
    if (!practice.cap) return "postal_code";
    if (practice.cointestata === null) return "coownership";
    if (
      practice.cointestata &&
      !findEvent(events, "cointestatari_avviso_visto")
    ) {
      return "coownership_notice";
    }
    if (practice.due_chiavi === null) return "keys";
    if (
      hasCurrentPostalCodeEvent(
        events,
        "geocoding_fallito",
        practice.cap,
      )
    ) {
      return "agency_fallback";
    }
    return "agency";
  }

  if (practice.status === "step3_appuntamento") {
    if (
      practice.is_proprietario === false &&
      practice.conosce_orari_proprietario === null
    ) {
      return "owner_availability";
    }
    if (
      practice.is_proprietario === false &&
      practice.conosce_orari_proprietario === false
    ) {
      return "availability_notice";
    }
    return "appointment";
  }

  if (!practice.ubicazione_auto) return "pickup_location";
  if (!practice.indirizzo_ritiro) return "pickup_address";
  if (!practice.telefono_ritiro) return "pickup_phone";
  return "pickup_phone";
}

export function getVisibleCustomerScreen(
  practice: PracticeRow,
  events: EventRow[],
  requested: string | undefined,
) {
  const next = resolveCustomerScreen(practice, events);
  if (!requested || practice.status === "creata" || practice.status === "completata") {
    return next;
  }

  if (requested === "welcome") return "welcome";

  const requestedStage = screenStage[requested as CustomerScreenId];
  if (
    !requestedStage ||
    statusRank[requestedStage] > statusRank[practice.status]
  ) {
    return next;
  }

  if (requested === "owner_notice" && practice.is_proprietario !== false) return next;
  if (requested === "coownership_notice" && !practice.cointestata) return next;
  if (requested === "plate_notice" && !findEvent(events, "targa_contestata")) {
    return next;
  }
  if (
    (requested === "owner_availability" || requested === "availability_notice") &&
    practice.is_proprietario !== false
  ) {
    return next;
  }

  return requested as CustomerScreenId;
}

export function getPreviousCustomerScreen(
  screen: CustomerScreenId,
  practice: PracticeRow,
  events: EventRow[],
): CustomerScreenId | null {
  const plateWasDisputed = Boolean(findEvent(events, "targa_contestata"));
  const previous: Partial<Record<CustomerScreenId, CustomerScreenId>> = {
    owner: "welcome",
    owner_notice: "owner",
    first_name: practice.is_proprietario ? "owner" : "owner_notice",
    last_name: "first_name",
    tax_code: "last_name",
    iban: "tax_code",
    plate: "iban",
    plate_notice: "plate",
    postal_code: plateWasDisputed ? "plate_notice" : "plate",
    coownership: "postal_code",
    coownership_notice: "coownership",
    keys: practice.cointestata ? "coownership_notice" : "coownership",
    agency: "keys",
    agency_fallback: "keys",
    owner_availability: "agency",
    availability_notice: "owner_availability",
    appointment:
      practice.is_proprietario === false ? "owner_availability" : "agency",
    pickup_location:
      practice.is_proprietario === false &&
      practice.conosce_orari_proprietario === false
        ? "availability_notice"
        : "appointment",
    pickup_address: "pickup_location",
    pickup_phone: "pickup_address",
  };
  return previous[screen] ?? null;
}

export function getCustomerProgress(
  screen: CustomerScreenId,
  isOwner: boolean | null,
) {
  const hasOwnerAvailability = isOwner === false;
  const total = hasOwnerAvailability ? 16 : 15;
  const beforeAppointment = hasOwnerAvailability ? 13 : 12;
  const base: Partial<Record<CustomerScreenId, number>> = {
    welcome: 1,
    owner: 2,
    owner_notice: 2,
    first_name: 3,
    last_name: 4,
    tax_code: 5,
    iban: 6,
    plate: 7,
    plate_notice: 7,
    postal_code: 8,
    coownership: 9,
    coownership_notice: 9,
    keys: 10,
    agency: 11,
    agency_fallback: 11,
    owner_availability: 12,
    availability_notice: 12,
    appointment: beforeAppointment,
    pickup_location: beforeAppointment + 1,
    pickup_address: beforeAppointment + 2,
    pickup_phone: beforeAppointment + 3,
    complete: total,
  };
  return { current: base[screen] ?? 1, total };
}
