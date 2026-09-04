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
