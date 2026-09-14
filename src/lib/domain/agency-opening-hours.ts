import {
  BUSINESS_RULES,
  type AppointmentSlot,
} from "@/lib/config/business-rules";

type OpeningHoursPoint = {
  day?: number;
  hour?: number;
  minute?: number;
};

type OpeningHoursPeriod = {
  open?: OpeningHoursPoint;
  close?: OpeningHoursPoint;
};

type OpeningHours = {
  periods?: OpeningHoursPeriod[];
};

type StoredOpeningHours =
  | OpeningHours
  | {
      regularOpeningHours?: OpeningHours | null;
      businessStatus?: string | null;
    };

export type OpeningRange = {
  startMinute: number;
  endMinute: number;
  label: string;
};

export type AgencyDaySchedule = {
  requestedDate: string;
  effectiveDate: string;
  shiftedToNextWorkingDay: boolean;
  slots: Record<AppointmentSlot, OpeningRange[]>;
};

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

function getRegularOpeningHours(value: unknown): OpeningHours | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as StoredOpeningHours;
  if (
    "businessStatus" in stored &&
    stored.businessStatus &&
    stored.businessStatus !== "OPERATIONAL"
  ) {
    return null;
  }
  if ("regularOpeningHours" in stored) {
    return stored.regularOpeningHours ?? null;
  }
  return stored as OpeningHours;
}

function pointToWeekMinute(point: OpeningHoursPoint | undefined) {
  if (
    !point ||
    !Number.isInteger(point.day) ||
    !Number.isInteger(point.hour) ||
    !Number.isInteger(point.minute) ||
    point.day! < 0 ||
    point.day! > 6 ||
    point.hour! < 0 ||
    point.hour! > 23 ||
    point.minute! < 0 ||
    point.minute! > 59
  ) {
    return null;
  }
  return point.day! * MINUTES_PER_DAY + point.hour! * 60 + point.minute!;
}

function mergeRanges(ranges: Array<{ startMinute: number; endMinute: number }>) {
  const sorted = ranges
    .filter((range) => range.endMinute > range.startMinute)
    .sort((left, right) => left.startMinute - right.startMinute);
  const merged: Array<{ startMinute: number; endMinute: number }> = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.startMinute <= previous.endMinute) {
      previous.endMinute = Math.max(previous.endMinute, range.endMinute);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function getDayRanges(hours: OpeningHours, weekday: number) {
  const dayStart = weekday * MINUTES_PER_DAY;
  const dayEnd = dayStart + MINUTES_PER_DAY;
  const ranges: Array<{ startMinute: number; endMinute: number }> = [];

  for (const period of hours.periods ?? []) {
    const open = pointToWeekMinute(period.open);
    if (open === null) continue;
    const closePoint = pointToWeekMinute(period.close);
    let close = closePoint ?? open + MINUTES_PER_WEEK;
    if (close <= open) close += MINUTES_PER_WEEK;

    for (const weekShift of [-MINUTES_PER_WEEK, 0, MINUTES_PER_WEEK]) {
      const shiftedOpen = open + weekShift;
      const shiftedClose = close + weekShift;
      const overlapStart = Math.max(shiftedOpen, dayStart);
      const overlapEnd = Math.min(shiftedClose, dayEnd);
      if (overlapEnd > overlapStart) {
        ranges.push({
          startMinute: overlapStart - dayStart,
          endMinute: overlapEnd - dayStart,
        });
      }
    }
  }

  return mergeRanges(ranges);
}

function parseClock(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatMinute(value: number) {
  if (value === MINUTES_PER_DAY) return "24:00";
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function withLabels(
  ranges: Array<{ startMinute: number; endMinute: number }>,
  start: number,
  end: number,
) {
  return ranges
    .map((range) => ({
      startMinute: Math.max(range.startMinute, start),
      endMinute: Math.min(range.endMinute, end),
    }))
    .filter((range) => range.endMinute > range.startMinute)
    .map((range) => ({
      ...range,
      label: `${formatMinute(range.startMinute)}–${formatMinute(range.endMinute)}`,
    }));
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12))
    .toISOString()
    .slice(0, 10);
}

function getWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function getAgencyScheduleForDate(
  storedHours: unknown,
  requestedDate: string,
): AgencyDaySchedule | null {
  const hours = getRegularOpeningHours(storedHours);
  if (!hours?.periods?.length || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return null;
  }
  const splitAt = parseClock(
    BUSINESS_RULES.agencyOpeningHours.continuousDaySplitAt,
  );

  for (
    let offset = 0;
    offset <= BUSINESS_RULES.agencyOpeningHours.nearestWorkingDaySearchDays;
    offset += 1
  ) {
    const effectiveDate = addDays(requestedDate, offset);
    const ranges = getDayRanges(hours, getWeekday(effectiveDate));
    if (ranges.length === 0) continue;
    return {
      requestedDate,
      effectiveDate,
      shiftedToNextWorkingDay: offset > 0,
      slots: {
        mattina: withLabels(ranges, 0, splitAt),
        pomeriggio: withLabels(ranges, splitAt, MINUTES_PER_DAY),
      },
    };
  }
  return null;
}

export function isAgencyOpeningHoursStale(
  updatedAt: string | null,
  now: Date = new Date(),
) {
  if (!updatedAt) return true;
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return true;
  const ttlMs = BUSINESS_RULES.agencyOpeningHours.ttlDays * 24 * 60 * 60 * 1000;
  return now.getTime() - timestamp >= ttlMs;
}
