import assert from "node:assert/strict";
import test from "node:test";

import {
  RoutesApiError,
  createGoogleRoutesProvider,
  sortRouteMetricsByDuration,
} from "../src/lib/google/routes.ts";

test("requests one driving matrix with the configured minimal field mask", async () => {
  let request;
  const provider = createGoogleRoutesProvider({
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return new Response(
        JSON.stringify([
          { distanceMeters: 14_200, duration: "1080s" },
          { distanceMeters: 9_500, duration: "1320.5s" },
        ]),
        { status: 200 },
      );
    },
  });
  const results = await provider.computeRouteMatrix(
    { lat: 44.1, lng: 8.2 },
    [
      { id: "one", lat: 44.2, lng: 8.3 },
      { id: "two", lat: 44.3, lng: 8.4 },
    ],
  );
  const body = JSON.parse(request.init.body);
  assert.equal(
    request.url,
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
  );
  assert.equal(request.init.headers["X-Goog-FieldMask"], "distanceMeters,duration");
  assert.equal(body.origins.length, 1);
  assert.equal(body.destinations.length, 2);
  assert.equal(body.travelMode, "DRIVE");
  assert.equal(body.routingPreference, "TRAFFIC_UNAWARE");
  assert.deepEqual(results, [
    { destinationId: "one", distanceKm: 14.2, durationMin: 18 },
    { destinationId: "two", distanceKm: 9.5, durationMin: 22 },
  ]);
});

test("orders route metrics by driving duration", () => {
  const metrics = sortRouteMetricsByDuration([
    { destinationId: "slow", distanceKm: 8, durationMin: 22 },
    { destinationId: "fast", distanceKm: 14, durationMin: 18 },
  ]);
  assert.deepEqual(
    metrics.map((metric) => metric.destinationId),
    ["fast", "slow"],
  );
});

test("rejects an incomplete route matrix so the caller can use Haversine", async () => {
  const provider = createGoogleRoutesProvider({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(JSON.stringify([{ distanceMeters: 1000, duration: "60s" }]), {
        status: 200,
      }),
  });
  await assert.rejects(
    provider.computeRouteMatrix(
      { lat: 44.1, lng: 8.2 },
      [
        { id: "one", lat: 44.2, lng: 8.3 },
        { id: "two", lat: 44.3, lng: 8.4 },
      ],
    ),
    (error) =>
      error instanceof RoutesApiError && error.message.includes("incompleta"),
  );
});
