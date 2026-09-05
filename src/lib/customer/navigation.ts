import type { PracticeStatus } from "@/lib/config/business-rules";

export const CUSTOMER_SCREEN_ORDER = [
  "welcome",
  "owner",
  "owner_notice",
  "first_name",
  "last_name",
  "tax_code",
  "iban",
  "plate",
  "customer_plate",
  "postal_code",
  "coownership",
  "coownership_notice",
  "keys",
  "agency",
  "agency_fallback",
  "owner_availability",
  "availability_notice",
  "appointment",
  "pickup_location",
  "pickup_address",
  "pickup_phone",
  "complete",
] as const;

export type CustomerScreenId = (typeof CUSTOMER_SCREEN_ORDER)[number];

export type CustomerNavigationContext = {
  isOwner: boolean | null;
  isCoOwned: boolean | null;
  knowsOwnerAvailability: boolean | null;
  hasDisputedPlate: boolean;
  useAgencyFallback: boolean;
};

export const CUSTOMER_SCREEN_STAGE: Record<CustomerScreenId, PracticeStatus> = {
  welcome: "creata",
  owner: "step1_dati",
  owner_notice: "step1_dati",
  first_name: "step1_dati",
  last_name: "step1_dati",
  tax_code: "step1_dati",
  iban: "step1_dati",
  plate: "step1_dati",
  customer_plate: "step1_dati",
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
  complete: "completata",
};

export function isCustomerScreenId(value: string): value is CustomerScreenId {
  return (CUSTOMER_SCREEN_ORDER as readonly string[]).includes(value);
}

export function isCustomerScreenApplicable(
  screen: CustomerScreenId,
  context: CustomerNavigationContext,
) {
  if (screen === "owner_notice") return context.isOwner === false;
  if (screen === "customer_plate") return context.hasDisputedPlate;
  if (screen === "coownership_notice") return context.isCoOwned === true;
  if (screen === "agency") return !context.useAgencyFallback;
  if (screen === "agency_fallback") return context.useAgencyFallback;
  if (screen === "owner_availability") return context.isOwner === false;
  if (screen === "availability_notice") {
    return (
      context.isOwner === false && context.knowsOwnerAvailability === false
    );
  }
  if (screen === "appointment") {
    return (
      context.isOwner === true ||
      (context.isOwner === false && context.knowsOwnerAvailability === true)
    );
  }
  return true;
}

function getAdjacentCustomerScreen(
  screen: CustomerScreenId,
  context: CustomerNavigationContext,
  direction: -1 | 1,
) {
  const currentIndex = CUSTOMER_SCREEN_ORDER.indexOf(screen);
  for (
    let index = currentIndex + direction;
    index >= 0 && index < CUSTOMER_SCREEN_ORDER.length;
    index += direction
  ) {
    const candidate = CUSTOMER_SCREEN_ORDER[index];
    if (isCustomerScreenApplicable(candidate, context)) return candidate;
  }
  return null;
}

export function getPreviousCustomerScreen(
  screen: CustomerScreenId,
  context: CustomerNavigationContext,
) {
  return getAdjacentCustomerScreen(screen, context, -1);
}

export function getNextCustomerScreen(
  screen: CustomerScreenId,
  context: CustomerNavigationContext,
) {
  return getAdjacentCustomerScreen(screen, context, 1);
}
