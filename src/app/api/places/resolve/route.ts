import {
  authorizePlacesPractice,
  reservePlacesRequest,
} from "@/lib/customer/places-proxy";
import { createPlaceSelectionProof } from "@/lib/customer/place-selection";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import {
  createGooglePlacesAutocompleteProvider,
  isPlacesSessionToken,
  type PlacesAutocompleteMode,
} from "@/lib/google/places-autocomplete";

type ResolveRequest = {
  token?: unknown;
  placeId?: unknown;
  mode?: unknown;
  sessionToken?: unknown;
};

function isMode(value: unknown): value is PlacesAutocompleteMode {
  return value === "address" || value === "establishment";
}

export async function POST(request: Request) {
  let body: ResolveRequest;
  try {
    body = (await request.json()) as ResolveRequest;
  } catch {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  if (
    typeof body.token !== "string" ||
    typeof body.placeId !== "string" ||
    !body.placeId ||
    !isMode(body.mode) ||
    typeof body.sessionToken !== "string" ||
    !isPlacesSessionToken(body.sessionToken)
  ) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  let authorization: { practiceId: string } | null;
  try {
    authorization = await authorizePlacesPractice(body.token);
  } catch {
    return Response.json({ errorCode: "service_unavailable" }, { status: 503 });
  }
  if (!authorization) {
    return Response.json({ errorCode: "invalid_token" }, { status: 401 });
  }

  try {
    if (!(await reservePlacesRequest(authorization.practiceId))) {
      return Response.json({ errorCode: "rate_limited" }, { status: 429 });
    }
  } catch {
    return Response.json({ errorCode: "service_unavailable" }, { status: 503 });
  }

  try {
    const provider = createGooglePlacesAutocompleteProvider({
      apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    });
    const place = await provider.resolve({
      placeId: body.placeId,
      sessionToken: body.sessionToken,
    });
    return Response.json({
      place,
      selectionProof: createPlaceSelectionProof(
        authorization.practiceId,
        place,
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Google Places Place Details: errore sconosciuto";
    await reportExternalServiceError({
      source: "Google Places",
      message,
      practiceId: authorization.practiceId,
      context: { mode: body.mode },
    });
    return Response.json({ errorCode: "service_unavailable" }, { status: 503 });
  }
}
