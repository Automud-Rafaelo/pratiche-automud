import "server-only";

import type { EventRow, PracticeRow } from "@/lib/admin/types";
import type { PracticeStatus } from "@/lib/config/business-rules";
import {
  CUSTOMER_SCREEN_ORDER,
  CUSTOMER_SCREEN_STAGE,
  getPreviousCustomerScreen,
  isCustomerScreenApplicable,
  isCustomerScreenId,
  type CustomerNavigationContext,
  type CustomerScreenId,
} from "@/lib/customer/navigation";

const statusRank: Record<PracticeStatus, number> = {
  creata: 0,
  step1_dati: 1,
  step2_agenzia: 2,
  step3_appuntamento: 3,
  step4_ritiro: 4,
  completata: 5,
};

const plateDecisionEventTypes = [
  "targa_confermata",
  "targa_contestata_richiesta",
  "targa_contestata",
] as const;

export function findEvent(
  events: EventRow[],
  type: string,
  predicate?: (event: EventRow) => boolean,
) {
  return events.find(
    (event) => event.tipo === type && (!predicate || predicate(event)),
  );
}

function hasUnresolvedGeocodingFailure(
  events: EventRow[],
  postalCode: string | null,
) {
  if (!postalCode) return false;
  const latestResult = events.find(
    (event) =>
      (event.tipo === "geocoding_fallito" ||
        event.tipo === "geocoding_riuscito") &&
      event.dettaglio.cap === postalCode,
  );
  return latestResult?.tipo === "geocoding_fallito";
}

export function getCustomerNavigationContext(
  practice: PracticeRow,
  events: EventRow[],
): CustomerNavigationContext {
  const latestPlateDecision = events.find((event) =>
    (plateDecisionEventTypes as readonly string[]).includes(event.tipo),
  );

  return {
    isOwner: practice.is_proprietario,
    isCoOwned: practice.cointestata,
    knowsOwnerAvailability: practice.conosce_orari_proprietario,
    hasDisputedPlate:
      latestPlateDecision?.tipo === "targa_contestata_richiesta" ||
      latestPlateDecision?.tipo === "targa_contestata",
    useAgencyFallback: hasUnresolvedGeocodingFailure(events, practice.cap),
  };
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

    const navigation = getCustomerNavigationContext(practice, events);
    if (navigation.hasDisputedPlate) return "customer_plate";
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
    return getCustomerNavigationContext(practice, events).useAgencyFallback
      ? "agency_fallback"
      : "agency";
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
  return "pickup_phone";
}

export function getVisibleCustomerScreen(
  practice: PracticeRow,
  events: EventRow[],
  requested: string | undefined,
) {
  const resumeScreen = resolveCustomerScreen(practice, events);
  if (
    !requested ||
    practice.status === "creata" ||
    practice.status === "completata"
  ) {
    return resumeScreen;
  }

  if (!isCustomerScreenId(requested)) return resumeScreen;
  if (requested === "welcome") return requested;

  const requestedStage = CUSTOMER_SCREEN_STAGE[requested];
  if (statusRank[requestedStage] > statusRank[practice.status]) {
    return resumeScreen;
  }

  const navigation = getCustomerNavigationContext(practice, events);
  return isCustomerScreenApplicable(requested, navigation)
    ? requested
    : resumeScreen;
}

const progressNeutralScreens = new Set<CustomerScreenId>([
  "owner_notice",
  "coownership_notice",
  "availability_notice",
]);

export function getCustomerProgress(
  screen: CustomerScreenId,
  navigation: CustomerNavigationContext,
) {
  const countedScreens = CUSTOMER_SCREEN_ORDER.filter(
    (candidate) =>
      isCustomerScreenApplicable(candidate, navigation) &&
      !progressNeutralScreens.has(candidate),
  );
  const countedScreen = progressNeutralScreens.has(screen)
    ? getPreviousCustomerScreen(screen, navigation)
    : screen;
  const index = countedScreen ? countedScreens.indexOf(countedScreen) : 0;
  return {
    current: Math.max(1, index + 1),
    total: countedScreens.length,
  };
}
