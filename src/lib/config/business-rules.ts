export const PRACTICE_STATUSES = [
  "creata",
  "step1_dati",
  "in_verifica",
  "bloccata",
  "step2_agenzia",
  "step3_appuntamento",
  "step4_ritiro",
  "completata",
] as const;

export const PRACTICE_TYPES = ["dini", "atto_demo"] as const;

export const APPOINTMENT_SLOTS = ["mattina", "pomeriggio"] as const;

export const PICKUP_LOCATIONS = ["casa", "deposito", "carrozzeria"] as const;

export const AGENCY_IMPORT_STATUSES = ["pending", "ok", "not_found"] as const;

export const BLOCKING_VERIFICATION_FIELDS = [
  "check_match_intestatario",
  "check_km_scalati",
  "check_fermo_amministrativo",
] as const;

export const INFORMATIVE_VERIFICATION_FIELDS = [
  "check_cdp_cartaceo",
  "check_revisione_scaduta",
] as const;

export const BUSINESS_RULES = {
  customerToken: {
    minimumLength: 32,
    urlSafePattern: /^[A-Za-z0-9_-]+$/,
  },
  nearbyAgencies: {
    radiusKm: 25,
    maximumResults: 4,
  },
  appointment: {
    windowDays: 6,
    includesToday: true,
    slots: APPOINTMENT_SLOTS,
  },
  validation: {
    italianPostalCodePattern: /^\d{5}$/,
    italianTaxCodePattern:
      /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i,
    italianIbanPattern: /^IT\d{2}[A-Z]\d{10}[A-Z0-9]{12}$/i,
    italianVehiclePlatePattern: /^[A-Z]{2}\d{3}[A-Z]{2}$/i,
  },
} as const;

export type PracticeStatus = (typeof PRACTICE_STATUSES)[number];
export type PracticeType = (typeof PRACTICE_TYPES)[number];
export type AppointmentSlot = (typeof APPOINTMENT_SLOTS)[number];
export type PickupLocation = (typeof PICKUP_LOCATIONS)[number];
export type AgencyImportStatus = (typeof AGENCY_IMPORT_STATUSES)[number];
