import assert from "node:assert/strict";
import test from "node:test";

import {
  PlacesApiError,
  createGooglePlacesAutocompleteProvider,
  createPlacesSessionToken,
  isPlacesSessionToken,
} from "../src/lib/google/places-autocomplete.ts";

test("builds an Italy-only address autocomplete request", async () => {
  let capturedUrl = "";
  let capturedInit;
  const provider = createGooglePlacesAutocompleteProvider({
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return Response.json({
        suggestions: [
          {
            placePrediction: {
              placeId: "address-1",
              text: { text: "Via Roma 1, Milano, Italia" },
              structuredFormat: {
                mainText: { text: "Via Roma 1" },
                secondaryText: { text: "Milano, Italia" },
              },
              types: ["street_address"],
            },
          },
        ],
      });
    },
  });

  const suggestions = await provider.suggest({
    query: "Via Roma",
    mode: "address",
    sessionToken: "session-1",
  });

  assert.equal(
    capturedUrl,
    "https://places.googleapis.com/v1/places:autocomplete",
  );
  const body = JSON.parse(String(capturedInit.body));
  assert.deepEqual(body.includedRegionCodes, ["it"]);
  assert.deepEqual(body.includedPrimaryTypes, [
    "street_address",
    "premise",
    "subpremise",
  ]);
  assert.equal(body.sessionToken, "session-1");
  assert.equal(suggestions[0].placeId, "address-1");
  assert.equal(suggestions[0].mainText, "Via Roma 1");
});

test("keeps establishment predictions and resolves minimal place details", async () => {
  const requests = [];
  const provider = createGooglePlacesAutocompleteProvider({
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith("places:autocomplete")) {
        return Response.json({
          suggestions: [
            {
              placePrediction: {
                placeId: "address-only",
                text: { text: "Via Milano" },
                types: ["route"],
              },
            },
            {
              placePrediction: {
                placeId: "shop-1",
                text: { text: "Carrozzeria Alfa, Torino" },
                types: ["car_repair", "establishment"],
              },
            },
          ],
        });
      }
      return Response.json({
        id: "shop-1",
        displayName: { text: "Carrozzeria Alfa" },
        formattedAddress: "Via Po 10, Torino, Italia",
        location: { latitude: 45.07, longitude: 7.69 },
      });
    },
  });

  const suggestions = await provider.suggest({
    query: "Carrozzeria",
    mode: "establishment",
    sessionToken: "session-2",
  });
  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.placeId),
    ["shop-1"],
  );

  const resolved = await provider.resolve({
    placeId: suggestions[0].placeId,
    sessionToken: "session-2",
  });
  assert.deepEqual(resolved, {
    placeId: "shop-1",
    displayName: "Carrozzeria Alfa",
    formattedAddress: "Via Po 10, Torino, Italia",
    lat: 45.07,
    lng: 7.69,
  });
  assert.match(requests[1].url, /sessionToken=session-2/);
  assert.equal(
    requests[1].init.headers["X-Goog-FieldMask"],
    "id,displayName,formattedAddress,location",
  );
});

test("surfaces Google API errors with their cause", async () => {
  const provider = createGooglePlacesAutocompleteProvider({
    apiKey: "test-key",
    fetchImpl: async () =>
      Response.json(
        { error: { status: "PERMISSION_DENIED", message: "API not enabled" } },
        { status: 403 },
      ),
  });

  await assert.rejects(
    provider.suggest({
      query: "Milano",
      mode: "address",
      sessionToken: "session-3",
    }),
    (error) =>
      error instanceof PlacesApiError &&
      error.message.includes("API not enabled") &&
      error.apiStatus === "PERMISSION_DENIED",
  );
});

test("creates and validates server session tokens", () => {
  const token = createPlacesSessionToken(
    () => "123e4567-e89b-12d3-a456-426614174000",
  );
  assert.equal(token, "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(isPlacesSessionToken(token), true);
  assert.equal(isPlacesSessionToken("contains spaces"), false);
  assert.equal(isPlacesSessionToken("x".repeat(37)), false);
});
