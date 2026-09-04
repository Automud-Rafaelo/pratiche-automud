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
  "geocoding_fallito",
  "external_service_error",
] as const;

export const CUSTOMER_SCREEN_IDS = [
  "welcome",
  "owner",
  "owner_notice",
  "first_name",
  "last_name",
  "tax_code",
  "iban",
  "plate",
  "plate_notice",
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
    placesBatchSize: 10,
  },
  validation: {
    italianPostalCodePattern: /^\d{5}$/,
    phonePattern: /^\+?[\d\s().-]{7,20}$/,
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

export function normalizeUppercaseValue(value: string) {
  return value.toUpperCase().replace(/\s+/g, "");
}

export function isValidItalianTaxCode(value: string) {
  return BUSINESS_RULES.validation.italianTaxCodePattern.test(
    normalizeUppercaseValue(value),
  );
}

export function isValidItalianPostalCode(value: string) {
  return BUSINESS_RULES.validation.italianPostalCodePattern.test(value.trim());
}

export function isValidPhone(value: string) {
  return BUSINESS_RULES.validation.phonePattern.test(value.trim());
}

export function isValidIban(value: string) {
  const normalized = normalizeUppercaseValue(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalized)) return false;

  const countryLengths: Record<string, number> = {
    AT: 20,
    BE: 16,
    CH: 21,
    DE: 22,
    ES: 24,
    FR: 27,
    GB: 22,
    IE: 22,
    IT: 27,
    NL: 18,
    PT: 25,
  };
  if (countryLengths[normalized.slice(0, 2)] !== normalized.length) return false;

  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  let remainder = 0;
  for (const character of rearranged) {
    const digits = /[A-Z]/.test(character)
      ? String(character.charCodeAt(0) - 55)
      : character;
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

export function calculateHaversineDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const latitude1 = toRadians(from.lat);
  const latitude2 = toRadians(to.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export type AppointmentPreferenceOption = {
  date: string;
  slots: readonly AppointmentSlot[];
};

function getRomeDateAndMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_RULES.appointmentPreference.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days, 12));
  return result.toISOString().slice(0, 10);
}

function getWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function getAppointmentPreferenceOptions(
  now: Date = new Date(),
): AppointmentPreferenceOption[] {
  const { date: today, minutes } = getRomeDateAndMinutes(now);
  const [afternoonHour, afternoonMinute] =
    BUSINESS_RULES.appointmentPreference.afternoonOnlyAfter
      .split(":")
      .map(Number);
  const [excludeHour, excludeMinute] =
    BUSINESS_RULES.appointmentPreference.excludeTodayAfter
      .split(":")
      .map(Number);
  const afternoonCutoff = afternoonHour * 60 + afternoonMinute;
  const excludeTodayCutoff = excludeHour * 60 + excludeMinute;
  const startOffset = minutes > excludeTodayCutoff ? 1 : 0;
  const options: AppointmentPreferenceOption[] = [];
  let offset = startOffset;

  while (
    options.length < BUSINESS_RULES.appointmentPreference.selectableDayCount
  ) {
    const date = addCalendarDays(today, offset);
    const weekday = getWeekday(date);

    if (
      !(BUSINESS_RULES.appointmentPreference.excludedWeekdays as readonly number[]).includes(
        weekday,
      )
    ) {
      const slots =
        offset === 0 && minutes > afternoonCutoff
          ? (["pomeriggio"] as const)
          : BUSINESS_RULES.appointmentPreference.slots;
      options.push({ date, slots });
    }

    offset += 1;
  }

  return options;
}

export type PracticeStatus = (typeof PRACTICE_STATUSES)[number];
export type PracticeType = (typeof PRACTICE_TYPES)[number];
export type AppointmentSlot = (typeof APPOINTMENT_SLOTS)[number];
export type PickupLocation = (typeof PICKUP_LOCATIONS)[number];
export type AgencyImportStatus = (typeof AGENCY_IMPORT_STATUSES)[number];
export type VerificationField = (typeof VERIFICATION_FIELDS)[number];
export type CustomerScreenId = (typeof CUSTOMER_SCREEN_IDS)[number];
