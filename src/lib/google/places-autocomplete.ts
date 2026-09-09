import { BUSINESS_RULES } from "@/lib/config/business-rules";

export type PlacesAutocompleteMode = "address" | "establishment";

export type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
};

export type ResolvedPlace = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  lat: number;
  lng: number;
};

export type PlacesAutocompleteProvider = {
  suggest(input: {
    query: string;
    mode: PlacesAutocompleteMode;
    sessionToken: string;
  }): Promise<PlaceSuggestion[]>;
  resolve(input: {
    placeId: string;
    sessionToken: string;
  }): Promise<ResolvedPlace>;
};

type FetchLike = typeof fetch;

type GoogleErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type AutocompletePayload = GoogleErrorPayload & {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      types?: string[];
    };
  }>;
};

type PlaceDetailsPayload = GoogleErrorPayload & {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
};

const AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";
const AUTOCOMPLETE_FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text.text",
  "suggestions.placePrediction.structuredFormat.mainText.text",
  "suggestions.placePrediction.structuredFormat.secondaryText.text",
  "suggestions.placePrediction.types",
].join(",");
const DETAILS_FIELD_MASK = "id,displayName,formattedAddress,location";

export class PlacesApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
    readonly apiStatus?: string,
  ) {
    super(message);
    this.name = "PlacesApiError";
  }
}

export function createPlacesSessionToken(
  generateUuid: () => string = () => crypto.randomUUID(),
) {
  return generateUuid();
}

export function isPlacesSessionToken(value: string) {
  return /^[A-Za-z0-9_-]{1,36}$/.test(value);
}

function getApiError(
  response: Response,
  payload: GoogleErrorPayload,
  operation: string,
) {
  const reason =
    payload.error?.message ||
    payload.error?.status ||
    `HTTP ${response.status}`;
  return new PlacesApiError(
    `Google Places ${operation}: ${reason}`,
    response.status,
    payload.error?.status,
  );
}

function isEstablishmentPrediction(types: string[] | undefined) {
  if (!types || types.length === 0) return true;
  return (
    types.includes("establishment") ||
    types.includes("car_repair") ||
    types.includes("storage")
  );
}

export function createGooglePlacesAutocompleteProvider({
  apiKey,
  fetchImpl = fetch,
}: {
  apiKey: string;
  fetchImpl?: FetchLike;
}): PlacesAutocompleteProvider {
  if (!apiKey.trim()) {
    throw new PlacesApiError("Google Places Autocomplete: chiave assente");
  }

  return {
    async suggest({ query, mode, sessionToken }) {
      const body: Record<string, unknown> = {
        input: query.trim(),
        includedRegionCodes:
          BUSINESS_RULES.placesAutocomplete.includedRegionCodes,
        languageCode: "it",
        regionCode: "IT",
        sessionToken,
      };
      if (mode === "address") {
        body.includedPrimaryTypes =
          BUSINESS_RULES.placesAutocomplete.addressPrimaryTypes;
      }

      const response = await fetchImpl(AUTOCOMPLETE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": AUTOCOMPLETE_FIELD_MASK,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const payload = (await response.json()) as AutocompletePayload;
      if (!response.ok || payload.error) {
        throw getApiError(response, payload, "Autocomplete");
      }

      return (payload.suggestions ?? [])
        .map((suggestion) => suggestion.placePrediction)
        .filter(
          (prediction) =>
            prediction?.placeId &&
            prediction.text?.text &&
            (mode === "address" ||
              isEstablishmentPrediction(prediction.types)),
        )
        .slice(0, BUSINESS_RULES.placesAutocomplete.maximumSuggestions)
        .map((prediction) => ({
          placeId: prediction?.placeId ?? "",
          mainText:
            prediction?.structuredFormat?.mainText?.text ??
            prediction?.text?.text ??
            "",
          secondaryText:
            prediction?.structuredFormat?.secondaryText?.text ?? "",
          fullText: prediction?.text?.text ?? "",
        }));
    },

    async resolve({ placeId, sessionToken }) {
      const parameters = new URLSearchParams({
        languageCode: "it",
        regionCode: "IT",
        sessionToken,
      });
      const response = await fetchImpl(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(
          placeId,
        )}?${parameters.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": DETAILS_FIELD_MASK,
          },
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as PlaceDetailsPayload;
      if (!response.ok || payload.error) {
        throw getApiError(response, payload, "Place Details");
      }

      const lat = payload.location?.latitude;
      const lng = payload.location?.longitude;
      if (
        !payload.id ||
        !payload.formattedAddress ||
        typeof lat !== "number" ||
        typeof lng !== "number"
      ) {
        throw new PlacesApiError(
          "Google Places Place Details: risposta incompleta",
          response.status,
        );
      }

      return {
        placeId: payload.id,
        displayName: payload.displayName?.text ?? "",
        formattedAddress: payload.formattedAddress,
        lat,
        lng,
      };
    },
  };
}
