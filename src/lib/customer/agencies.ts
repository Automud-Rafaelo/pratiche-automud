import "server-only";

import type { AgencyRow } from "@/lib/admin/types";
import {
  BUSINESS_RULES,
  calculateHaversineDistanceKm,
} from "@/lib/config/business-rules";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import {
  createGoogleRoutesProvider,
  sortRouteMetricsByDuration,
  type RouteDestination,
} from "@/lib/google/routes";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type NearbyAgency = Pick<
  AgencyRow,
  "id" | "nome" | "indirizzo" | "telefono"
> & {
  distanceKm: number;
  durationMin: number | null;
  distanceKind: "route" | "haversine";
};

export type Coordinates = { lat: number; lng: number };

type RankedAgency = NearbyAgency & RouteDestination;

function toFallback(agencies: readonly RankedAgency[]): NearbyAgency[] {
  return agencies
    .slice(0, BUSINESS_RULES.nearbyAgencies.maximumResults)
    .map(({ id, nome, indirizzo, telefono, distanceKm }) => ({
      id,
      nome,
      indirizzo,
      telefono,
      distanceKm,
      durationMin: null,
      distanceKind: "haversine",
    }));
}

export async function findNearbyAgencies(
  practiceId: string,
  coordinates: Coordinates,
): Promise<
  | { ok: true; agencies: NearbyAgency[]; noneWithinRadius: boolean }
  | { ok: false; error: string }
> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("agenzie")
    .select("id,nome,indirizzo,telefono,lat,lng")
    .eq("attiva", true)
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) {
    const message = `Lettura agenzie fallita: ${error.message}`;
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
        distanceKm: calculateHaversineDistanceKm(coordinates, { lat, lng }),
        durationMin: null,
        distanceKind: "haversine" as const,
      };
    })
    .filter(
      (agency) =>
        Number.isFinite(agency.lat) &&
        Number.isFinite(agency.lng) &&
        Number.isFinite(agency.distanceKm),
    )
    .sort((left, right) => left.distanceKm - right.distanceKm);

  if (ranked.length === 0) {
    return {
      ok: false,
      error: "Nessuna agenzia attiva con coordinate disponibili",
    };
  }

  const noneWithinRadius =
    ranked[0].distanceKm > BUSINESS_RULES.nearbyAgencies.radiusKm;
  const candidates = ranked.slice(
    0,
    BUSINESS_RULES.agencyRouting.candidateCount,
  );

  try {
    const provider = createGoogleRoutesProvider({
      apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    });
    const routeMetrics = sortRouteMetricsByDuration(
      await provider.computeRouteMatrix(coordinates, candidates),
    );
    const candidateById = new Map(
      candidates.map((agency) => [agency.id, agency]),
    );
    const agencies = routeMetrics
      .map((metric) => {
        const agency = candidateById.get(metric.destinationId);
        if (!agency) return null;
        return {
          id: agency.id,
          nome: agency.nome,
          indirizzo: agency.indirizzo,
          telefono: agency.telefono,
          distanceKm: metric.distanceKm,
          durationMin: metric.durationMin,
          distanceKind: "route" as const,
        };
      })
      .filter((agency) => agency !== null)
      .slice(0, BUSINESS_RULES.nearbyAgencies.maximumResults);
    if (
      agencies.length !== BUSINESS_RULES.nearbyAgencies.maximumResults &&
      candidates.length >= BUSINESS_RULES.nearbyAgencies.maximumResults
    ) {
      throw new Error("Google Routes: matrice incompleta");
    }
    return { ok: true, agencies, noneWithinRadius };
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
    return {
      ok: true,
      agencies: toFallback(candidates),
      noneWithinRadius,
    };
  }
}
