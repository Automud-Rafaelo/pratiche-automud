import { BUSINESS_RULES } from "@/lib/config/business-rules";
import {
  selectMatchingAgencyPlace,
  type AgencyPlaceCandidate,
  type AgencyPlaceMatch,
  type AgencyPlaceSearchCriteria,
} from "@/lib/domain/agency-google-place";
import { PlacesApiError } from "@/lib/google/places-autocomplete";

export type AgencyPlaceSearchProvider = {
  searchAgency(
    criteria: AgencyPlaceSearchCriteria,
  ): Promise<AgencyPlaceMatch | null>;
};

type FetchLike = typeof fetch;

export function createGoogleAgencyPlaceSearchProvider({
  apiKey,
  fetchImpl = fetch,
}: {
  apiKey: string;
  fetchImpl?: FetchLike;
}): AgencyPlaceSearchProvider {
  if (!apiKey.trim()) {
    throw new PlacesApiError("Google Places Text Search: chiave assente");
  }

  return {
    async searchAgency(criteria) {
      const textQuery = [
        criteria.nome,
        criteria.indirizzo,
        criteria.cap,
        criteria.comune,
        criteria.provincia,
      ]
        .filter(Boolean)
        .join(" ");
      const response = await fetchImpl(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              BUSINESS_RULES.agencyImport.placeSearchFieldMask,
          },
          body: JSON.stringify({
            textQuery,
            pageSize: BUSINESS_RULES.agencyImport.placeSearchMaximumResults,
            languageCode: "it",
            regionCode: "IT",
          }),
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as {
        error?: { message?: string; status?: string };
        places?: AgencyPlaceCandidate[];
      };
      if (!response.ok || payload.error) {
        const reason =
          payload.error?.message ||
          payload.error?.status ||
          `HTTP ${response.status}`;
        throw new PlacesApiError(
          `Google Places Text Search: ${reason}`,
          response.status,
          payload.error?.status,
        );
      }

      return selectMatchingAgencyPlace(payload.places ?? [], criteria);
    },
  };
}
