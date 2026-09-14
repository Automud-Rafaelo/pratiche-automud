import { BUSINESS_RULES } from "@/lib/config/business-rules";

export type RouteCoordinates = { lat: number; lng: number };

export type RouteDestination = RouteCoordinates & { id: string };

export type RouteMetric = {
  destinationId: string;
  distanceKm: number;
  durationMin: number;
};

export type RouteMatrixLogElement = {
  originIndex: number | null;
  destinationIndex: number | null;
  distanceMeters: number | null;
  duration: string | null;
};

export type RouteMatrixResult = {
  metrics: RouteMetric[];
  rawElements: RouteMatrixLogElement[];
};

export type RoutesProvider = {
  computeRouteMatrix(
    origin: RouteCoordinates,
    destinations: readonly RouteDestination[],
  ): Promise<RouteMatrixResult>;
};

type FetchLike = typeof fetch;
type RouteMatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  status?: unknown;
  condition?: string;
  distanceMeters?: number;
  duration?: string;
};

export class RoutesApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutesApiError";
  }
}

export function sortRouteMetricsByDuration(metrics: readonly RouteMetric[]) {
  return [...metrics].sort(
    (left, right) =>
      left.durationMin - right.durationMin ||
      left.distanceKm - right.distanceKm ||
      left.destinationId.localeCompare(right.destinationId),
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
      if (destinations.length === 0) {
        return { metrics: [], rawElements: [] };
      }
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
        | RouteMatrixElement[]
        | { error?: { message?: string; status?: string } };
      if (!response.ok || !Array.isArray(payload)) {
        const reason =
          (!Array.isArray(payload) &&
            (payload.error?.message || payload.error?.status)) ||
          `HTTP ${response.status}`;
        throw new RoutesApiError(`Google Routes: ${reason}`);
      }
      const rawElements = payload.map<RouteMatrixLogElement>((element) => ({
        originIndex:
          typeof element.originIndex === "number" ? element.originIndex : null,
        destinationIndex:
          typeof element.destinationIndex === "number"
            ? element.destinationIndex
            : null,
        distanceMeters:
          typeof element.distanceMeters === "number"
            ? element.distanceMeters
            : null,
        duration: typeof element.duration === "string" ? element.duration : null,
      }));
      const metricByDestinationIndex = new Map<number, RouteMetric>();

      for (const element of payload) {
        if (
          element.condition !== "ROUTE_EXISTS" ||
          element.originIndex !== 0 ||
          !Number.isInteger(element.destinationIndex) ||
          (element.destinationIndex as number) < 0 ||
          (element.destinationIndex as number) >= destinations.length
        ) {
          continue;
        }
        const destinationIndex = element.destinationIndex as number;
        const durationMin = parseDurationMinutes(element.duration);
        if (
          typeof element.distanceMeters !== "number" ||
          !Number.isFinite(element.distanceMeters) ||
          durationMin === null
        ) {
          continue;
        }
        const metric = {
          destinationId: destinations[destinationIndex].id,
          distanceKm: element.distanceMeters / 1000,
          durationMin,
        };
        const current = metricByDestinationIndex.get(destinationIndex);
        if (
          !current ||
          sortRouteMetricsByDuration([metric, current])[0] === metric
        ) {
          metricByDestinationIndex.set(destinationIndex, metric);
        }
      }

      return {
        metrics: destinations.flatMap((_, index) => {
          const metric = metricByDestinationIndex.get(index);
          return metric ? [metric] : [];
        }),
        rawElements,
      };
    },
  };
}
