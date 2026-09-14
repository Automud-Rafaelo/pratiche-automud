import assert from "node:assert/strict";
import test from "node:test";

import { BUSINESS_RULES } from "../src/lib/config/business-rules.ts";
import {
  reconcileAgencyCoordinates,
  selectMatchingAgencyPlace,
} from "../src/lib/domain/agency-google-place.ts";
import {
  findAgencyReconciliationMatch,
  isAgencyEligible,
  parseAgencyCsv,
  parseNullableSiNo,
} from "../src/lib/domain/agency-import.ts";

const header =
  "nome,email,telefono,indirizzo,cap,comune,provincia,maps_url,iban,intestatario_iban,costi_pratica,delega,istanza";

test("parses the new agency CSV shape and nullable si/no fields", () => {
  const [agency] = parseAgencyCsv(
    `${header}\nAgenzia Uno,INFO@EXAMPLE.IT,010123,Via Roma 1,00100,Roma,RM,https://share.google/x,IT00,Titolare,50 euro,no,\n`,
  );
  assert.equal(agency.email, "INFO@EXAMPLE.IT");
  assert.equal(parseNullableSiNo(agency.delega), false);
  assert.equal(parseNullableSiNo(agency.istanza), null);
});

test("reconciles by normalized email and CAP, then by name and CAP", () => {
  const [row] = parseAgencyCsv(
    `${header}\nNuovo Nome,INFO@EXAMPLE.IT,010123,Via Roma 1,00100,Roma,RM,,,,,no,no\n`,
  );
  const agencies = [
    { id: "email", nome: "Vecchio Nome", email: "info@example.it", cap: "00100" },
    { id: "name", nome: "Nuovo Nome", email: "old@example.it", cap: "00100" },
  ];
  assert.equal(
    findAgencyReconciliationMatch(row, agencies, new Set())?.id,
    "email",
  );
  assert.equal(
    findAgencyReconciliationMatch(row, agencies, new Set(["email"]))?.id,
    "name",
  );
});

test("uses email alone when the CSV CAP is empty", () => {
  const [row] = parseAgencyCsv(
    `${header}\nAgenzia,info@example.it,010123,Via Roma 1,,Roma,RM,,,,,no,no\n`,
  );
  const agencies = [
    { id: "match", nome: "Altro", email: "INFO@example.it", cap: "00100" },
  ];
  assert.equal(
    findAgencyReconciliationMatch(row, agencies, new Set())?.id,
    "match",
  );
});

test("requires phone, delega false and istanza false for activation", () => {
  assert.equal(
    isAgencyEligible({ telefono: "010123", delega: false, istanza: false }),
    true,
  );
  assert.equal(
    isAgencyEligible({ telefono: "010123", delega: null, istanza: false }),
    false,
  );
  assert.equal(
    isAgencyEligible({ telefono: "010123", delega: false, istanza: true }),
    false,
  );
});

test("matches a Google place only when municipality and postal code agree", () => {
  const criteria = {
    nome: "Agenzia Uno",
    indirizzo: "Via Roma 1",
    cap: "00100",
    comune: "Roma",
    provincia: "RM",
  };
  const component = (longText, types) => ({ longText, types });
  const match = selectMatchingAgencyPlace(
    [
      {
        id: "wrong-city",
        formattedAddress: "Via Roma 1, 20100 Milano",
        location: { latitude: 45.46, longitude: 9.19 },
        addressComponents: [
          component("20100", ["postal_code"]),
          component("Milano", ["locality"]),
        ],
      },
      {
        id: "right-city",
        formattedAddress: "Via Roma 1, 00100 Roma",
        location: { latitude: 41.9, longitude: 12.49 },
        addressComponents: [
          component("00100", ["postal_code"]),
          component("Roma", ["locality"]),
        ],
      },
    ],
    criteria,
  );

  assert.equal(match?.placeId, "right-city");
});

test("keeps stored coordinates when Google is within 300 metres", () => {
  assert.equal(
    BUSINESS_RULES.agencyImport.coordinateCorrectionThresholdKm,
    0.3,
  );
  const result = reconcileAgencyCoordinates(
    { lat: 0, lng: 0 },
    { lat: 0.002, lng: 0 },
  );

  assert.equal(result.corrected, false);
  assert.deepEqual(
    { lat: result.lat, lng: result.lng },
    { lat: 0, lng: 0 },
  );
  assert.ok(result.distanceKm !== null && result.distanceKm < 0.3);
});

test("uses Google coordinates and flags a correction beyond 300 metres", () => {
  const result = reconcileAgencyCoordinates(
    { lat: 0, lng: 0 },
    { lat: 0.004, lng: 0 },
  );

  assert.equal(result.corrected, true);
  assert.deepEqual(
    { lat: result.lat, lng: result.lng },
    { lat: 0.004, lng: 0 },
  );
  assert.ok(result.distanceKm !== null && result.distanceKm > 0.3);
});
