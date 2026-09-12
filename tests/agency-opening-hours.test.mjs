import assert from "node:assert/strict";
import test from "node:test";

import {
  getAgencyScheduleForDate,
  isAgencyOpeningHoursStale,
} from "../src/lib/domain/agency-opening-hours.ts";
import { createGoogleAgencyOpeningHoursProvider } from "../src/lib/google/agency-opening-hours.ts";

const point = (day, hour, minute = 0) => ({ day, hour, minute });
const period = (open, close) => ({ open, close });
const monday = "2026-09-07";

test("splits continuous opening hours at 13:00", () => {
  const schedule = getAgencyScheduleForDate(
    { periods: [period(point(1, 9), point(1, 18))] },
    monday,
  );
  assert.deepEqual(
    schedule?.slots.mattina.map((range) => range.label),
    ["9:00–13:00"],
  );
  assert.deepEqual(
    schedule?.slots.pomeriggio.map((range) => range.label),
    ["13:00–18:00"],
  );
});

test("keeps split morning and afternoon periods", () => {
  const schedule = getAgencyScheduleForDate(
    {
      regularOpeningHours: {
        periods: [
          period(point(1, 9), point(1, 13)),
          period(point(1, 15), point(1, 18, 30)),
        ],
      },
      businessStatus: "OPERATIONAL",
    },
    monday,
  );
  assert.equal(schedule?.slots.mattina[0].label, "9:00–13:00");
  assert.equal(schedule?.slots.pomeriggio[0].label, "15:00–18:30");
});

test("does not expose hours for a closed business", () => {
  assert.equal(
    getAgencyScheduleForDate(
      {
        regularOpeningHours: {
          periods: [period(point(1, 9), point(1, 18))],
        },
        businessStatus: "CLOSED_TEMPORARILY",
      },
      monday,
    ),
    null,
  );
});

test("carries an overnight period into the following morning", () => {
  const hours = { periods: [period(point(1, 20), point(2, 2))] };
  const mondaySchedule = getAgencyScheduleForDate(hours, monday);
  const tuesdaySchedule = getAgencyScheduleForDate(hours, "2026-09-08");
  assert.equal(mondaySchedule?.slots.pomeriggio[0].label, "20:00–24:00");
  assert.equal(tuesdaySchedule?.slots.mattina[0].label, "0:00–2:00");
});

test("uses the next working day when the requested weekday is missing", () => {
  const schedule = getAgencyScheduleForDate(
    { periods: [period(point(2, 9), point(2, 18))] },
    monday,
  );
  assert.equal(schedule?.effectiveDate, "2026-09-08");
  assert.equal(schedule?.shiftedToNextWorkingDay, true);
});

test("marks opening hours stale after seven days", () => {
  const now = new Date("2026-09-12T12:00:00Z");
  assert.equal(isAgencyOpeningHoursStale(null, now), true);
  assert.equal(
    isAgencyOpeningHoursStale("2026-09-06T12:00:01Z", now),
    false,
  );
  assert.equal(
    isAgencyOpeningHoursStale("2026-09-05T12:00:00Z", now),
    true,
  );
});

test("requests only regular hours and business status from Place Details", async () => {
  let request;
  const provider = createGoogleAgencyOpeningHoursProvider({
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return new Response(
        JSON.stringify({
          regularOpeningHours: { periods: [] },
          businessStatus: "OPERATIONAL",
        }),
        { status: 200 },
      );
    },
  });
  const details = await provider.getOpeningHours("place/with spaces");
  assert.match(request.url, /place%2Fwith%20spaces/);
  assert.equal(
    request.init.headers["X-Goog-FieldMask"],
    "regularOpeningHours,businessStatus",
  );
  assert.equal(details.businessStatus, "OPERATIONAL");
});
