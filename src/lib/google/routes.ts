import { BUSINESS_RULES } from "@/lib/config/business-rules";

export type RouteCoordinates = { lat: number; lng: number };

export type RouteDestination = RouteCoordinates & { id: string };

export type RouteMetric = {
  destinationId: string;
  distanceKm: number;
  durationMin: number;
};

export type RoutesProvider = {
  computeRouteMatrix(
    origin: RouteCoordinates,
    destinations: readonly RouteDestination[],
  ): Promise<RouteMetric[]>;
};

type FetchLike = typeof fetch;

export class RoutesApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutesApiError";
  }
}

export function sortRouteMetricsByDuration(metrics: readonly RouteMetric[]) {
  return [...metrics].sort(
    (left, right) => left.durationMin - right.durationMin,
  );
}

function toWaypoint(coordinates: RouteCoordinates) {
  return {
    waypoint: {
      location: {
        latLng: {
          latitude: coordinates.lat,
          longitude: coordinates.lng,
        },
      },
    },
  };
}

function parseDurationMinutes(value: string | undefined) {
  const match = value?.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.max(1, Math.round(Number(match[1]) / 60)) : null;
}

export function createGoogleRoutesProvider({
  apiKey,
  fetchImpl = fetch,
}: {
  apiKey: string;
  fetchImpl?: FetchLike;
}): RoutesProvider {
  if (!apiKey.trim()) throw new RoutesApiError("Google Routes: chiave assente");

  return {
    async computeRouteMatrix(origin, destinations) {
      if (destinations.length === 0) return [];
      let response: Response;
      try {
        response = await fetchImpl(
          "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": BUSINESS_RULES.agencyRouting.fieldMask,
            },
            body: JSON.stringify({
              origins: [toWaypoint(origin)],
              destinations: destinations.map(toWaypoint),
              travelMode: BUSINESS_RULES.agencyRouting.travelMode,
              routingPreference:
                BUSINESS_RULES.agencyRouting.routingPreference,
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(
              BUSINESS_RULES.agencyRouting.timeoutMs,
            ),
          },
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : "errore di rete";
        throw new RoutesApiError(`Google Routes: ${reason}`);
      }
      const payload = (await response.json()) as
        | Array<{ distanceMeters?: number; duration?: string }>
        | { error?: { message?: string; status?: string } };
      if (!response.ok || !Array.isArray(payload)) {
        const reason =
          (!Array.isArray(payload) &&
            (payload.error?.message || payload.error?.status)) ||
          `HTTP ${response.status}`;
        throw new RoutesApiError(`Google Routes: ${reason}`);
      }
      if (payload.length !== destinations.length) {
        throw new RoutesApiError("Google Routes: matrice incompleta");
      }

      return payload.map((element, index) => {
        const durationMin = parseDurationMinutes(element.duration);
        if (
          typeof element.distanceMeters !== "number" ||
          !Number.isFinite(element.distanceMeters) ||
          durationMin === null
        ) {
          throw new RoutesApiError(
            "Google Routes: destinazione senza distanza o durata",
          );
        }
        return {
          destinationId: destinations[index].id,
          distanceKm: element.distanceMeters / 1000,
          durationMin,
        };
      });
    },
  };
}
