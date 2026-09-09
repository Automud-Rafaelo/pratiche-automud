import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { BUSINESS_RULES } from "@/lib/config/business-rules";
import type { ResolvedPlace } from "@/lib/google/places-autocomplete";

type PlaceSelectionPayload = {
  practiceId: string;
  place: ResolvedPlace;
  issuedAt: number;
};

function getSigningSecret() {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error("Place selection signing secret is missing.");
  return secret;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function isResolvedPlace(value: unknown): value is ResolvedPlace {
  if (!value || typeof value !== "object") return false;
  const place = value as Partial<ResolvedPlace>;
  return (
    typeof place.placeId === "string" &&
    Boolean(place.placeId) &&
    typeof place.displayName === "string" &&
    typeof place.formattedAddress === "string" &&
    Boolean(place.formattedAddress) &&
    typeof place.lat === "number" &&
    Number.isFinite(place.lat) &&
    place.lat >= -90 &&
    place.lat <= 90 &&
    typeof place.lng === "number" &&
    Number.isFinite(place.lng) &&
    place.lng >= -180 &&
    place.lng <= 180
  );
}

export function createPlaceSelectionProof(
  practiceId: string,
  place: ResolvedPlace,
) {
  const payload: PlaceSelectionPayload = {
    practiceId,
    place,
    issuedAt: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyPlaceSelectionProof(
  proof: string,
  expectedPracticeId: string,
) {
  const [encodedPayload, suppliedSignature, extra] = proof.split(".");
  if (!encodedPayload || !suppliedSignature || extra) return null;

  const expectedSignature = sign(encodedPayload);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<PlaceSelectionPayload>;
    if (
      payload.practiceId !== expectedPracticeId ||
      typeof payload.issuedAt !== "number" ||
      Date.now() - payload.issuedAt >
        BUSINESS_RULES.placesAutocomplete.selectionProofMaxAgeMs ||
      payload.issuedAt > Date.now() + 60_000 ||
      !isResolvedPlace(payload.place)
    ) {
      return null;
    }
    return payload.place;
  } catch {
    return null;
  }
}
