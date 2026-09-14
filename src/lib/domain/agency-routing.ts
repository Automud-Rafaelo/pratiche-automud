export type AgencyTravelCandidate = {
  id: string;
  haversineDistanceKm: number;
};

export type AgencyRouteMetric = {
  destinationId: string;
  distanceKm: number;
  durationMin: number;
};

export type RankedAgencyTravel = {
  id: string;
  distanceKm: number;
  durationMin: number | null;
  distanceKind: "route" | "haversine";
};

export type StoredAgencyProposal = {
  id: string;
  durata_min: number | null;
  distanza_km: number;
  ordine: number;
};

function compareRankedAgencies(
  left: RankedAgencyTravel,
  right: RankedAgencyTravel,
) {
  const leftDuration = left.durationMin ?? Number.POSITIVE_INFINITY;
  const rightDuration = right.durationMin ?? Number.POSITIVE_INFINITY;
  return (
    leftDuration - rightDuration ||
    left.distanceKm - right.distanceKm ||
    left.id.localeCompare(right.id)
  );
}

export function rankAgencyTravelOptions(
  candidates: readonly AgencyTravelCandidate[],
  routeMetrics: readonly AgencyRouteMetric[],
) {
  const routeByAgencyId = new Map(
    routeMetrics.map((metric) => [metric.destinationId, metric]),
  );

  return candidates
    .map<RankedAgencyTravel>((candidate) => {
      const route = routeByAgencyId.get(candidate.id);
      return route
        ? {
            id: candidate.id,
            distanceKm: route.distanceKm,
            durationMin: route.durationMin,
            distanceKind: "route",
          }
        : {
            id: candidate.id,
            distanceKm: candidate.haversineDistanceKm,
            durationMin: null,
            distanceKind: "haversine",
          };
    })
    .sort(compareRankedAgencies);
}

export function createStoredAgencyProposals(
  agencies: readonly RankedAgencyTravel[],
): StoredAgencyProposal[] {
  return agencies.map((agency, index) => ({
    id: agency.id,
    durata_min: agency.durationMin,
    distanza_km: Number(agency.distanceKm.toFixed(2)),
    ordine: index + 1,
  }));
}

export function parseStoredAgencyProposals(
  value: unknown,
): StoredAgencyProposal[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const proposals: StoredAgencyProposal[] = [];
  const seenAgencyIds = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    const duration = candidate.durata_min;
    if (
      typeof candidate.id !== "string" ||
      !candidate.id ||
      seenAgencyIds.has(candidate.id) ||
      typeof candidate.distanza_km !== "number" ||
      !Number.isFinite(candidate.distanza_km) ||
      candidate.distanza_km < 0 ||
      (duration !== null &&
        (typeof duration !== "number" ||
          !Number.isInteger(duration) ||
          duration < 0)) ||
      typeof candidate.ordine !== "number" ||
      !Number.isInteger(candidate.ordine) ||
      candidate.ordine < 1
    ) {
      return null;
    }
    seenAgencyIds.add(candidate.id);
    proposals.push({
      id: candidate.id,
      durata_min: duration as number | null,
      distanza_km: candidate.distanza_km,
      ordine: candidate.ordine,
    });
  }

  return proposals.sort(
    (left, right) =>
      left.ordine - right.ordine || left.id.localeCompare(right.id),
  );
}
