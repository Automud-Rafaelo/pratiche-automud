import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateScreenDurationMs,
  createScreenCompletionDetail,
  groupScreenTimings,
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

test("tracks a sequence of three different completed screens", () => {
  const viewedEvents = [
    {
      id: "view-owner",
      pratica_id: "practice",
      created_at: "2026-09-05T08:00:00.000Z",
      tipo: "schermata_visualizzata",
      dettaglio: { schermata: "owner" },
    },
    {
      id: "view-tax-code",
      pratica_id: "practice",
      created_at: "2026-09-05T08:01:00.000Z",
      tipo: "schermata_visualizzata",
      dettaglio: { schermata: "tax_code" },
    },
    {
      id: "view-agency",
      pratica_id: "practice",
      created_at: "2026-09-05T08:02:00.000Z",
      tipo: "schermata_visualizzata",
      dettaglio: { schermata: "agency" },
    },
  ];
  const completed = [
    createScreenCompletionDetail(
      viewedEvents,
      "owner",
      Date.parse("2026-09-05T08:00:05.000Z"),
    ),
    createScreenCompletionDetail(
      viewedEvents,
      "tax_code",
      Date.parse("2026-09-05T08:01:08.000Z"),
    ),
    createScreenCompletionDetail(
      viewedEvents,
      "agency",
      Date.parse("2026-09-05T08:02:13.000Z"),
    ),
  ];

  assert.deepEqual(completed, [
    { schermata: "owner", durata_ms: 5000 },
    { schermata: "tax_code", durata_ms: 8000 },
    { schermata: "agency", durata_ms: 13000 },
  ]);
});

test("groups repeated completions with readable labels and totals", () => {
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
    {
      id: "tax-code",
      pratica_id: "practice",
      created_at: "2026-09-05T07:59:00.000Z",
      tipo: "schermata_completata",
      dettaglio: { schermata: "tax_code", durata_ms: 5000 },
    },
  ];

  assert.equal(listScreenTimings(events).length, 3);
  assert.deepEqual(
    groupScreenTimings(events),
    [
      {
        screen: "tax_code",
        label: "Codice fiscale",
        passCount: 1,
        totalDurationMs: 5000,
      },
      {
        screen: "iban",
        label: "IBAN",
        passCount: 2,
        totalDurationMs: 3300,
      },
    ],
  );
});
