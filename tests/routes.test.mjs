import assert from "node:assert/strict";
import test from "node:test";

import {
  rankAgencyTravelOptions,
} from "../src/lib/domain/agency-routing.ts";
import {
  createGoogleRoutesProvider,
  sortRouteMetricsByDuration,
} from "../src/lib/google/routes.ts";

test("matches a shuffled route matrix to agencies by destinationIndex", async () => {
  let request;
  const provider = createGoogleRoutesProvider({
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return new Response(
        JSON.stringify([
          {
            originIndex: 0,
            destinationIndex: 2,
            status: {},
            condition: "ROUTE_EXISTS",
            distanceMeters: 9_500,
            duration: "1320.5s",
          },
          {
            originIndex: 0,
            destinationIndex: 0,
            status: {},
            condition: "ROUTE_EXISTS",
            distanceMeters: 14_200,
            duration: "1080s",
          },
          {
            originIndex: 0,
            destinationIndex: 1,
            status: {},
            condition: "ROUTE_NOT_FOUND",
          },
        ]),
        { status: 200 },
      );
    },
  });
  const result = await provider.computeRouteMatrix(
    { lat: 44.1, lng: 8.2 },
    [
      { id: "one", lat: 44.2, lng: 8.3 },
      { id: "two", lat: 44.3, lng: 8.4 },
      { id: "three", lat: 44.4, lng: 8.5 },
    ],
  );
  const body = JSON.parse(request.init.body);
  assert.equal(
    request.url,
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
  );
  assert.equal(
    request.init.headers["X-Goog-FieldMask"],
    "originIndex,destinationIndex,status,condition,distanceMeters,duration",
  );
  assert.equal(body.origins.length, 1);
  assert.equal(body.destinations.length, 3);
  assert.equal(body.travelMode, "DRIVE");
  assert.equal(body.routingPreference, "TRAFFIC_UNAWARE");
  assert.deepEqual(result.metrics, [
    { destinationId: "one", distanceKm: 14.2, durationMin: 18 },
    { destinationId: "three", distanceKm: 9.5, durationMin: 22 },
  ]);
  assert.deepEqual(result.rawElements, [
    {
      originIndex: 0,
      destinationIndex: 2,
      distanceMeters: 9_500,
      duration: "1320.5s",
    },
    {
      originIndex: 0,
      destinationIndex: 0,
      distanceMeters: 14_200,
      duration: "1080s",
    },
    {
      originIndex: 0,
      destinationIndex: 1,
      distanceMeters: null,
      duration: null,
    },
  ]);
});

test("uses Haversine only for matrix elements without ROUTE_EXISTS", () => {
  const ranked = rankAgencyTravelOptions(
    [
      { id: "route", haversineDistanceKm: 4 },
      { id: "fallback", haversineDistanceKm: 5 },
    ],
    [{ destinationId: "route", distanceKm: 8, durationMin: 12 }],
  );
  assert.deepEqual(ranked, [
    {
      id: "route",
      distanceKm: 8,
      durationMin: 12,
      distanceKind: "route",
    },
    {
      id: "fallback",
      distanceKm: 5,
      durationMin: null,
      distanceKind: "haversine",
    },
  ]);
});

test("orders deterministically by duration, distance, then agency id", () => {
  const candidates = [
    { id: "agency-c", haversineDistanceKm: 7 },
    { id: "agency-b", haversineDistanceKm: 6 },
    { id: "agency-a", haversineDistanceKm: 5 },
    { id: "agency-fallback", haversineDistanceKm: 2 },
  ];
  const metrics = [
    { destinationId: "agency-c", distanceKm: 9, durationMin: 12 },
    { destinationId: "agency-b", distanceKm: 4, durationMin: 10 },
    { destinationId: "agency-a", distanceKm: 4, durationMin: 10 },
  ];

  const first = rankAgencyTravelOptions(candidates, metrics);
  const second = rankAgencyTravelOptions(
    [...candidates].reverse(),
    [...metrics].reverse(),
  );
  assert.deepEqual(
    first.map((agency) => agency.id),
    ["agency-a", "agency-b", "agency-c", "agency-fallback"],
  );
  assert.deepEqual(second, first);
});

test("sortRouteMetricsByDuration applies all deterministic tie breakers", () => {
  const metrics = sortRouteMetricsByDuration([
    { destinationId: "c", distanceKm: 8, durationMin: 22 },
    { destinationId: "b", distanceKm: 7, durationMin: 18 },
    { destinationId: "a", distanceKm: 7, durationMin: 18 },
  ]);
  assert.deepEqual(
    metrics.map((metric) => metric.destinationId),
    ["a", "b", "c"],
  );
});
