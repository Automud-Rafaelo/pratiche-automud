import "server-only";

import type { AgencyRow } from "@/lib/admin/types";
import {
  BUSINESS_RULES,
  calculateHaversineDistanceKm,
} from "@/lib/config/business-rules";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type NearbyAgency = Pick<
  AgencyRow,
  "id" | "nome" | "indirizzo" | "telefono"
> & { distanceKm: number };

export type Coordinates = { lat: number; lng: number };

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
    .map((agency) => ({
      id: agency.id as string,
      nome: agency.nome as string,
      indirizzo: agency.indirizzo as string,
      telefono: agency.telefono as string | null,
      distanceKm: calculateHaversineDistanceKm(coordinates, {
        lat: Number(agency.lat),
        lng: Number(agency.lng),
      }),
    }))
    .filter((agency) => Number.isFinite(agency.distanceKm))
    .sort((left, right) => left.distanceKm - right.distanceKm);

  if (ranked.length === 0) {
    return {
      ok: false,
      error: "Nessuna agenzia attiva con coordinate disponibili",
    };
  }

  const withinRadius = ranked.filter(
    (agency) => agency.distanceKm <= BUSINESS_RULES.nearbyAgencies.radiusKm,
  );
  const noneWithinRadius = withinRadius.length === 0;
  const source = noneWithinRadius ? ranked : withinRadius;

  return {
    ok: true,
    noneWithinRadius,
    agencies: source.slice(0, BUSINESS_RULES.nearbyAgencies.maximumResults),
  };
}
