import {
  BUSINESS_RULES,
  calculateHaversineDistanceKm,
} from "@/lib/config/business-rules";

export type AgencyPlaceAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

export type AgencyPlaceCandidate = {
  id?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: AgencyPlaceAddressComponent[];
};

export type AgencyPlaceMatch = {
  placeId: string;
  formattedAddress: string;
  lat: number;
  lng: number;
};

export type AgencyPlaceSearchCriteria = {
  nome: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
};

type Coordinates = { lat: number; lng: number };

function normalizeLocationValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function componentValues(
  components: readonly AgencyPlaceAddressComponent[],
  acceptedTypes: readonly string[],
) {
  return components
    .filter((component) =>
      component.types?.some((type) => acceptedTypes.includes(type)),
    )
    .flatMap((component) => [component.longText, component.shortText])
    .filter((value): value is string => Boolean(value))
    .map(normalizeLocationValue);
}

export function matchesAgencyPlaceLocation(
  candidate: AgencyPlaceCandidate,
  criteria: Pick<AgencyPlaceSearchCriteria, "cap" | "comune">,
) {
  const components = candidate.addressComponents ?? [];
  const expectedPostalCode = normalizeLocationValue(criteria.cap);
  const expectedMunicipality = normalizeLocationValue(criteria.comune);

  if (expectedPostalCode) {
    const postalCodes = componentValues(
      components,
      BUSINESS_RULES.agencyImport.postalCodeComponentTypes,
    );
    if (!postalCodes.includes(expectedPostalCode)) return false;
  }

  if (expectedMunicipality) {
    const municipalities = componentValues(
      components,
      BUSINESS_RULES.agencyImport.municipalityComponentTypes,
    );
    if (!municipalities.includes(expectedMunicipality)) return false;
  }

  return true;
}

export function selectMatchingAgencyPlace(
  candidates: readonly AgencyPlaceCandidate[],
  criteria: AgencyPlaceSearchCriteria,
): AgencyPlaceMatch | null {
  for (const candidate of candidates) {
    if (!matchesAgencyPlaceLocation(candidate, criteria)) continue;
    const latitude = candidate.location?.latitude;
    const longitude = candidate.location?.longitude;
    if (
      !candidate.id ||
      !candidate.formattedAddress ||
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      continue;
    }
    return {
      placeId: candidate.id,
      formattedAddress: candidate.formattedAddress,
      lat: latitude,
      lng: longitude,
    };
  }
  return null;
}

export type AgencyCoordinateReconciliation = Coordinates & {
  corrected: boolean;
  distanceKm: number | null;
};

export function reconcileAgencyCoordinates(
  existing: { lat: number | null; lng: number | null },
  google: Coordinates,
): AgencyCoordinateReconciliation {
  if (existing.lat === null || existing.lng === null) {
    return { ...google, corrected: false, distanceKm: null };
  }

  const stored = { lat: Number(existing.lat), lng: Number(existing.lng) };
  if (!Number.isFinite(stored.lat) || !Number.isFinite(stored.lng)) {
    return { ...google, corrected: false, distanceKm: null };
  }

  const distanceKm = calculateHaversineDistanceKm(stored, google);
  if (
    distanceKm <=
    BUSINESS_RULES.agencyImport.coordinateCorrectionThresholdKm
  ) {
    return { ...stored, corrected: false, distanceKm };
  }

  return { ...google, corrected: true, distanceKm };
}
