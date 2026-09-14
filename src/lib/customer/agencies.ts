import "server-only";

import type { AgencyRow } from "@/lib/admin/types";
import {
  BUSINESS_RULES,
  calculateHaversineDistanceKm,
} from "@/lib/config/business-rules";
import {
  createStoredAgencyProposals,
  parseStoredAgencyProposals,
  rankAgencyTravelOptions,
  type RankedAgencyTravel,
  type StoredAgencyProposal,
} from "@/lib/domain/agency-routing";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import {
  createGoogleRoutesProvider,
  type RouteDestination,
  type RouteMatrixLogElement,
} from "@/lib/google/routes";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import {
  recordCustomerEvent,
  updateCustomerPractice,
} from "./data";

export type NearbyAgency = Pick<
  AgencyRow,
  "id" | "nome" | "indirizzo" | "telefono"
> & {
  distanceKm: number;
  durationMin: number | null;
  distanceKind: "route" | "haversine";
};

export type Coordinates = { lat: number; lng: number };

type RankedAgency = Pick<
  AgencyRow,
  "id" | "nome" | "indirizzo" | "telefono"
> &
  RouteDestination & {
    haversineDistanceKm: number;
  };

type NearbyAgencySuccess = {
  ok: true;
  agencies: NearbyAgency[];
  proposals: StoredAgencyProposal[];
  noneWithinRadius: boolean;
};

type NearbyAgencyResult =
  | NearbyAgencySuccess
  | { ok: false; error: string };

function compareHaversineCandidates(
  left: RankedAgency,
  right: RankedAgency,
) {
  return (
    left.haversineDistanceKm - right.haversineDistanceKm ||
    left.id.localeCompare(right.id)
  );
}

function toNearbyAgencies(
  rankedTravel: readonly RankedAgencyTravel[],
  candidateById: ReadonlyMap<string, RankedAgency>,
): NearbyAgency[] {
  return rankedTravel.flatMap((travel) => {
    const agency = candidateById.get(travel.id);
    return agency
      ? [
          {
            id: agency.id,
            nome: agency.nome,
            indirizzo: agency.indirizzo,
            telefono: agency.telefono,
            distanceKm: travel.distanceKm,
            durationMin: travel.durationMin,
            distanceKind: travel.distanceKind,
          },
        ]
      : [];
  });
}

function toResult(
  candidates: readonly RankedAgency[],
  routeMetrics: Parameters<typeof rankAgencyTravelOptions>[1],
  noneWithinRadius: boolean,
): NearbyAgencySuccess {
  const candidateById = new Map(
    candidates.map((agency) => [agency.id, agency]),
  );
  const rankedTravel = rankAgencyTravelOptions(candidates, routeMetrics).slice(
    0,
    BUSINESS_RULES.nearbyAgencies.maximumResults,
  );
  return {
    ok: true,
    agencies: toNearbyAgencies(rankedTravel, candidateById),
    proposals: createStoredAgencyProposals(rankedTravel),
    noneWithinRadius,
  };
}

async function recordRoutesResponse(
  practiceId: string,
  rawElements: readonly RouteMatrixLogElement[],
) {
  try {
    await recordCustomerEvent(practiceId, "routes_matrix_response", {
      elementi: rawElements.map((element) => ({
        originIndex: element.originIndex,
        destinationIndex: element.destinationIndex,
        duration: element.duration,
        distanceMeters: element.distanceMeters,
      })),
    });
  } catch (error) {
    console.error("Unable to persist Routes matrix diagnostics", error);
  }
}

export async function findNearbyAgencies(
  practiceId: string,
  coordinates: Coordinates,
): Promise<NearbyAgencyResult> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("agenzie")
    .select("id,nome,indirizzo,telefono,lat,lng")
    .eq("attiva", true)
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) {
    const message = "Lettura agenzie fallita: " + error.message;
    await reportExternalServiceError({
      source: "Supabase",
      message,
      practiceId,
    });
    return { ok: false, error: message };
  }

  const ranked = (data ?? [])
    .map((agency) => {
      const lat = Number(agency.lat);
      const lng = Number(agency.lng);
      return {
        id: agency.id as string,
        nome: agency.nome as string,
        indirizzo: agency.indirizzo as string,
        telefono: agency.telefono as string | null,
        lat,
        lng,
        haversineDistanceKm: calculateHaversineDistanceKm(coordinates, {
          lat,
          lng,
        }),
      };
    })
    .filter(
      (agency) =>
        Number.isFinite(agency.lat) &&
        Number.isFinite(agency.lng) &&
        Number.isFinite(agency.haversineDistanceKm),
    )
    .sort(compareHaversineCandidates);

  if (ranked.length === 0) {
    return {
      ok: false,
      error: "Nessuna agenzia attiva con coordinate disponibili",
    };
  }

  const noneWithinRadius =
    ranked[0].haversineDistanceKm >
    BUSINESS_RULES.nearbyAgencies.radiusKm;
  const candidates = ranked.slice(
    0,
    BUSINESS_RULES.agencyRouting.candidateCount,
  );

  try {
    const provider = createGoogleRoutesProvider({
      apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    });
    const matrix = await provider.computeRouteMatrix(coordinates, candidates);
    await recordRoutesResponse(practiceId, matrix.rawElements);
    return toResult(candidates, matrix.metrics, noneWithinRadius);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Google Routes: errore sconosciuto";
    await reportExternalServiceError({
      source: "Google Routes",
      message,
      practiceId,
    });
    return toResult(candidates, [], noneWithinRadius);
  }
}

async function loadStoredAgencies(
  practiceId: string,
  coordinates: Coordinates,
  proposals: StoredAgencyProposal[],
): Promise<NearbyAgencyResult> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("agenzie")
    .select("id,nome,indirizzo,telefono,lat,lng")
    .in(
      "id",
      proposals.map((proposal) => proposal.id),
    );

  if (error) {
    const message = "Lettura agenzie proposte fallita: " + error.message;
    await reportExternalServiceError({
      source: "Supabase",
      message,
      practiceId,
    });
    return { ok: false, error: message };
  }

  const agencyById = new Map(
    (data ?? []).map((agency) => [agency.id as string, agency]),
  );
  const agencies = proposals.flatMap<NearbyAgency>((proposal) => {
    const agency = agencyById.get(proposal.id);
    return agency
      ? [
          {
            id: proposal.id,
            nome: agency.nome as string,
            indirizzo: agency.indirizzo as string,
            telefono: agency.telefono as string | null,
            distanceKm: proposal.distanza_km,
            durationMin: proposal.durata_min,
            distanceKind:
              proposal.durata_min === null ? "haversine" : "route",
          },
        ]
      : [];
  });

  if (agencies.length === 0) {
    return { ok: false, error: "Le agenzie proposte non sono più disponibili" };
  }

  const { data: activeCoordinates, error: radiusError } = await supabase
    .from("agenzie")
    .select("lat,lng")
    .eq("attiva", true)
    .not("lat", "is", null)
    .not("lng", "is", null);
  if (radiusError) {
    await reportExternalServiceError({
      source: "Supabase",
      message:
        "Controllo raggio agenzie proposte fallito: " + radiusError.message,
      practiceId,
    });
  }

  const haversineDistances = (activeCoordinates ?? []).flatMap((agency) => {
    const lat = Number(agency.lat);
    const lng = Number(agency.lng);
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? [calculateHaversineDistanceKm(coordinates, { lat, lng })]
      : [];
  });
  const noneWithinRadius =
    haversineDistances.length > 0 &&
    Math.min(...haversineDistances) >
      BUSINESS_RULES.nearbyAgencies.radiusKm;

  return { ok: true, agencies, proposals, noneWithinRadius };
}

export async function loadOrCreateNearbyAgencies(
  practiceId: string,
  coordinates: Coordinates,
  storedProposals: unknown,
): Promise<NearbyAgencyResult> {
  const proposals = parseStoredAgencyProposals(storedProposals);
  if (proposals) {
    return loadStoredAgencies(practiceId, coordinates, proposals);
  }

  const result = await findNearbyAgencies(practiceId, coordinates);
  if (!result.ok) return result;

  await updateCustomerPractice(practiceId, {
    agenzie_proposte: result.proposals,
  });
  return result;
}
