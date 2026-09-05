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

export type GeocodingResult =
  | { status: "ok"; coordinates: Coordinates }
  | { status: "not_found"; error: string }
  | { status: "unavailable"; error: string };

export async function geocodePostalCode(
  practiceId: string,
  postalCode: string,
): Promise<GeocodingResult> {
  const supabase = createAdminSupabaseClient();
  const { data: cached, error: cacheError } = await supabase
    .from("cap_coordinate")
    .select("lat,lng")
    .eq("cap", postalCode)
    .maybeSingle();

  if (cacheError) {
    const message = `Cache CAP non disponibile: ${cacheError.message}`;
    await reportExternalServiceError({
      source: "Supabase",
      message,
      practiceId,
      context: { cap: postalCode },
    });
    return { status: "unavailable", error: message };
  }
  if (cached) {
    return {
      status: "ok",
      coordinates: { lat: Number(cached.lat), lng: Number(cached.lng) },
    };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    const message = "Google Geocoding: chiave assente";
    await reportExternalServiceError({
      source: "Google Geocoding",
      message,
      practiceId,
      context: { cap: postalCode },
    });
    return { status: "unavailable", error: message };
  }

  const parameters = new URLSearchParams({
    components: `postal_code:${postalCode}|country:IT`,
    key: apiKey,
    language: "it",
    region: "it",
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${parameters.toString()}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as {
      status?: string;
      error_message?: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };

    if (payload.status === "ZERO_RESULTS") {
      return {
        status: "not_found",
        error: "Google Geocoding: CAP non trovato",
      };
    }

    if (!response.ok || payload.status !== "OK") {
      const reason =
        payload.error_message ||
        payload.status ||
        `HTTP ${response.status}`;
      const message = `Google Geocoding: ${reason}`;
      await reportExternalServiceError({
        source: "Google Geocoding",
        message,
        practiceId,
        context: { cap: postalCode },
      });
      return { status: "unavailable", error: message };
    }

    const location = payload.results?.[0]?.geometry?.location;
    if (typeof location?.lat !== "number" || typeof location.lng !== "number") {
      return {
        status: "not_found",
        error: "Google Geocoding: coordinate assenti nella risposta",
      };
    }

    const coordinates = { lat: location.lat, lng: location.lng };
    const { error: saveError } = await supabase.from("cap_coordinate").upsert({
      cap: postalCode,
      lat: coordinates.lat,
      lng: coordinates.lng,
    });
    if (saveError) {
      const message = `Salvataggio cache CAP fallito: ${saveError.message}`;
      await reportExternalServiceError({
        source: "Supabase",
        message,
        practiceId,
        context: { cap: postalCode },
      });
      return { status: "unavailable", error: message };
    }
    return { status: "ok", coordinates };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "errore di rete";
    const message = `Google Geocoding: ${reason}`;
    await reportExternalServiceError({
      source: "Google Geocoding",
      message,
      practiceId,
      context: { cap: postalCode },
    });
    return { status: "unavailable", error: message };
  }
}

export async function findNearbyAgencies(
  practiceId: string,
  postalCode: string,
): Promise<
  | { ok: true; agencies: NearbyAgency[]; noneWithinRadius: boolean }
  | { ok: false; reason: "not_found" | "unavailable"; error: string }
> {
  const geocoding = await geocodePostalCode(practiceId, postalCode);
  if (geocoding.status !== "ok") {
    return {
      ok: false,
      reason:
        geocoding.status === "not_found" ? "not_found" : "unavailable",
      error: geocoding.error,
    };
  }

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
      context: { cap: postalCode },
    });
    return { ok: false, reason: "unavailable", error: message };
  }

  const ranked = (data ?? [])
    .map((agency) => ({
      id: agency.id as string,
      nome: agency.nome as string,
      indirizzo: agency.indirizzo as string,
      telefono: agency.telefono as string | null,
      distanceKm: calculateHaversineDistanceKm(geocoding.coordinates, {
        lat: Number(agency.lat),
        lng: Number(agency.lng),
      }),
    }))
    .filter((agency) => Number.isFinite(agency.distanceKm))
    .sort((left, right) => left.distanceKm - right.distanceKm);

  if (ranked.length === 0) {
    return {
      ok: false,
      reason: "unavailable",
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
