import { BUSINESS_RULES } from "@/lib/config/business-rules";
import { PlacesApiError } from "@/lib/google/places-autocomplete";

export type AgencyOpeningHoursDetails = {
  regularOpeningHours: unknown | null;
  businessStatus: string | null;
};

export type AgencyOpeningHoursProvider = {
  getOpeningHours(placeId: string): Promise<AgencyOpeningHoursDetails>;
};

type FetchLike = typeof fetch;

export function createGoogleAgencyOpeningHoursProvider({
  apiKey,
  fetchImpl = fetch,
}: {
  apiKey: string;
  fetchImpl?: FetchLike;
}): AgencyOpeningHoursProvider {
  if (!apiKey.trim()) {
    throw new PlacesApiError("Google Places Place Details: chiave assente");
  }

  return {
    async getOpeningHours(placeId) {
      const parameters = new URLSearchParams({
        languageCode: "it",
        regionCode: "IT",
      });
      const response = await fetchImpl(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(
          placeId,
        )}?${parameters.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              BUSINESS_RULES.agencyOpeningHours.placeDetailsFieldMask,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(
            BUSINESS_RULES.agencyOpeningHours.refreshTimeoutMs,
          ),
        },
      );
      const payload = (await response.json()) as {
        error?: { message?: string; status?: string };
        regularOpeningHours?: unknown;
        businessStatus?: string;
      };
      if (!response.ok || payload.error) {
        const reason =
          payload.error?.message ||
          payload.error?.status ||
          `HTTP ${response.status}`;
        throw new PlacesApiError(
          `Google Places Place Details: ${reason}`,
          response.status,
          payload.error?.status,
        );
      }
      return {
        regularOpeningHours: payload.regularOpeningHours ?? null,
        businessStatus: payload.businessStatus ?? null,
      };
    },
  };
}
