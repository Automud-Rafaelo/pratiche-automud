import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateHaversineDistanceKm,
  getAppointmentPreferenceOptions,
  isValidIban,
  isValidItalianPostalCode,
  isValidItalianTaxCode,
  isValidPhone,
  normalizeVehicleName,
} from "../src/lib/config/business-rules.ts";

test("validates Italian tax-code format and check character", () => {
  assert.equal(isValidItalianTaxCode("RSSMRA80A01H501U"), true);
  assert.equal(isValidItalianTaxCode("VRDLGI85T10A562C"), true);
  assert.equal(isValidItalianTaxCode("BNCLGU80A01H501A"), true);
  assert.equal(isValidItalianTaxCode("RSSMRA80A01H501A"), false);
  assert.equal(isValidItalianTaxCode("MMMMMMMMMMMMMMMM"), false);
});

test("validates IBAN length and mod-97 checksum", () => {
  assert.equal(isValidIban("IT60 X054 2811 1010 0000 0123 456"), true);
  assert.equal(isValidIban("IT60 X054 2811 1010 0000 0123 457"), false);
  assert.equal(isValidIban("IT60X05428"), false);
});

test("validates Italian postal codes and phone numbers", () => {
  assert.equal(isValidItalianPostalCode("00100"), true);
  assert.equal(isValidItalianPostalCode("0100"), false);
  assert.equal(isValidPhone("+39 333 123 4567"), true);
  assert.equal(isValidPhone("123"), false);
});

test("capitalizes every word in vehicle make and model", () => {
  assert.equal(normalizeVehicleName("  audi   a3 "), "Audi A3");
});

test("returns exactly three appointment days and skips Sunday", () => {
  const options = getAppointmentPreferenceOptions(
    new Date("2026-09-04T09:00:00Z"),
  );
  assert.deepEqual(
    options.map((option) => option.date),
    ["2026-09-04", "2026-09-05", "2026-09-07"],
  );
});

test("limits today to afternoon after noon in Rome", () => {
  const [today] = getAppointmentPreferenceOptions(
    new Date("2026-09-04T11:30:00Z"),
  );
  assert.deepEqual(today.slots, ["pomeriggio"]);
});

test("starts from tomorrow after 18:00 in Rome", () => {
  const [first] = getAppointmentPreferenceOptions(
    new Date("2026-09-04T16:30:00Z"),
  );
  assert.equal(first.date, "2026-09-05");
});

test("calculates Haversine distance in kilometres", () => {
  const distance = calculateHaversineDistanceKm(
    { lat: 41.9028, lng: 12.4964 },
    { lat: 45.4642, lng: 9.19 },
  );
  assert.ok(distance > 470 && distance < 490);
});
