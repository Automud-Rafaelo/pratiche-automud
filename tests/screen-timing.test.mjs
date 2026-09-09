import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateScreenDurationMs,
  listScreenTimings,
} from "../src/lib/customer/screen-timing.ts";

test("calculates duration from the latest matching screen view", () => {
  const events = [
    {
      id: "new",
      pratica_id: "practice",
      created_at: "2026-09-05T08:00:05.000Z",
      tipo: "schermata_visualizzata",
      dettaglio: { schermata: "iban" },
    },
    {
      id: "old",
      pratica_id: "practice",
      created_at: "2026-09-05T08:00:00.000Z",
      tipo: "schermata_visualizzata",
      dettaglio: { schermata: "iban" },
    },
  ];

  assert.equal(
    calculateScreenDurationMs(
      events,
      "iban",
      Date.parse("2026-09-05T08:00:08.250Z"),
    ),
    3250,
  );
});

test("keeps every repeated screen completion in the timing report", () => {
  const events = [
    {
      id: "second",
      pratica_id: "practice",
      created_at: "2026-09-05T08:01:00.000Z",
      tipo: "schermata_completata",
      dettaglio: { schermata: "iban", durata_ms: 2200 },
    },
    {
      id: "first",
      pratica_id: "practice",
      created_at: "2026-09-05T08:00:00.000Z",
      tipo: "schermata_completata",
      dettaglio: { schermata: "iban", durata_ms: 1100 },
    },
  ];

  assert.deepEqual(
    listScreenTimings(events).map(({ screen, durationMs }) => ({
      screen,
      durationMs,
    })),
    [
      { screen: "iban", durationMs: 2200 },
      { screen: "iban", durationMs: 1100 },
    ],
  );
});
