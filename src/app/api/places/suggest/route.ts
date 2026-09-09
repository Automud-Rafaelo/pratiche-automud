import { BUSINESS_RULES } from "@/lib/config/business-rules";
import {
  authorizePlacesPractice,
  reservePlacesRequest,
} from "@/lib/customer/places-proxy";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import {
  createGooglePlacesAutocompleteProvider,
  createPlacesSessionToken,
  isPlacesSessionToken,
  type PlacesAutocompleteMode,
} from "@/lib/google/places-autocomplete";

type SuggestRequest = {
  token?: unknown;
  input?: unknown;
  mode?: unknown;
  sessionToken?: unknown;
};

function isMode(value: unknown): value is PlacesAutocompleteMode {
  return value === "address" || value === "establishment";
}

export async function POST(request: Request) {
  let body: SuggestRequest;
  try {
    body = (await request.json()) as SuggestRequest;
  } catch {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  if (
    typeof body.token !== "string" ||
    typeof body.input !== "string" ||
    body.input.trim().length <
      BUSINESS_RULES.placesAutocomplete.minimumInputLength ||
    !isMode(body.mode) ||
    (body.sessionToken !== undefined &&
      (typeof body.sessionToken !== "string" ||
        !isPlacesSessionToken(body.sessionToken)))
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

  const sessionToken =
    typeof body.sessionToken === "string"
      ? body.sessionToken
      : createPlacesSessionToken();

  try {
    const provider = createGooglePlacesAutocompleteProvider({
      apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    });
    const suggestions = await provider.suggest({
      query: body.input,
      mode: body.mode,
      sessionToken,
    });
    return Response.json({ suggestions, sessionToken });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Google Places Autocomplete: errore sconosciuto";
    await reportExternalServiceError({
      source: "Google Places",
      message,
      practiceId: authorization.practiceId,
      context: { mode: body.mode },
    });
    return Response.json({ errorCode: "service_unavailable" }, { status: 503 });
  }
}
