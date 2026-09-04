export const PRACTICE_STATUSES = [
  "creata",
  "step1_dati",
  "step2_agenzia",
  "step3_appuntamento",
  "step4_ritiro",
  "completata",
] as const;

export const PRACTICE_TYPES = ["dini", "atto_demo"] as const;
export const APPOINTMENT_SLOTS = ["mattina", "pomeriggio"] as const;
export const PICKUP_LOCATIONS = ["casa", "deposito", "carrozzeria"] as const;
export const AGENCY_IMPORT_STATUSES = ["pending", "ok", "not_found"] as const;

export const VERIFICATION_FIELDS = [
  "check_intestatario_non_corrisponde",
  "check_cdp_cartaceo",
  "check_revisione_scaduta",
  "check_km_scalati",
  "check_fermo_amministrativo",
] as const;

export const ATTENTION_EVENT_TYPES = [
  "targa_contestata",
  "nessuna_agenzia_nel_raggio",
] as const;

export const BUSINESS_RULES = {
  customerToken: {
    minimumLength: 32,
    urlSafePattern: /^[A-Za-z0-9_-]+$/,
  },
  nearbyAgencies: {
    radiusKm: 25,
    maximumResults: 4,
    showNearestWhenNoneInRadius: true,
  },
  appointmentPreference: {
    timeZone: "Europe/Rome",
    selectableDayCount: 3,
    excludedWeekdays: [0],
    afternoonOnlyAfter: "12:00",
    excludeTodayAfter: "18:00",
    slots: APPOINTMENT_SLOTS,
  },
  adminSession: {
    durationHours: 12,
    loginRateLimit: {
      maximumAttempts: 5,
      windowMinutes: 15,
    },
  },
  agencyImport: {
    deduplicationFields: ["nome_normalizzato", "cap_normalizzato"],
    activeRequiresPhone: true,
  },
  validation: {
    italianPostalCodePattern: /^\d{5}$/,
    italianTaxCodePattern:
      /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i,
    italianIbanPattern: /^IT\d{2}[A-Z]\d{10}[A-Z0-9]{12}$/i,
    modernItalianVehiclePlatePattern: /^[A-Z]{2}\d{3}[A-Z]{2}$/,
  },
} as const;

export function normalizeVehiclePlate(value: string) {
  return value.toUpperCase().replace(/[\s-]+/g, "");
}

export function normalizeAgencyKeyPart(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export type PracticeStatus = (typeof PRACTICE_STATUSES)[number];
export type PracticeType = (typeof PRACTICE_TYPES)[number];
export type AppointmentSlot = (typeof APPOINTMENT_SLOTS)[number];
export type PickupLocation = (typeof PICKUP_LOCATIONS)[number];
export type AgencyImportStatus = (typeof AGENCY_IMPORT_STATUSES)[number];
export type VerificationField = (typeof VERIFICATION_FIELDS)[number];
