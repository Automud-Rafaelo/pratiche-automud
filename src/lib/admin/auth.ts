import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { BUSINESS_RULES } from "@/lib/config/business-rules";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const ADMIN_COOKIE_NAME = "automud_admin_session";

type SessionPayload = {
  version: 1;
  expiresAt: number;
  nonce: string;
};

function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error("Missing ADMIN_PASSWORD environment variable.");
  }

  return password;
}

function signPayload(payload: string) {
  return createHmac("sha256", getAdminPassword())
    .update(payload)
    .digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function encodeSession(payload: SessionPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

function verifySession(value: string | undefined) {
  if (!value) {
    return false;
  }

  const [encodedPayload, signature, ...extraParts] = value.split(".");
  if (!encodedPayload || !signature || extraParts.length > 0) {
    return false;
  }

  if (!constantTimeEqual(signature, signPayload(encodedPayload))) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;

    return (
      payload.version === 1 &&
      typeof payload.nonce === "string" &&
      typeof payload.expiresAt === "number" &&
      payload.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}

export function verifyAdminPassword(candidate: string) {
  return constantTimeEqual(candidate, getAdminPassword());
}

export async function hasValidAdminSession() {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function requireAdminSession() {
  if (!(await hasValidAdminSession())) {
    redirect("/admin/login");
  }
}

export async function createAdminSession() {
  const durationSeconds = BUSINESS_RULES.adminSession.durationHours * 60 * 60;
  const expiresAt = Date.now() + durationSeconds * 1000;
  const cookieStore = await cookies();

  cookieStore.set(
    ADMIN_COOKIE_NAME,
    encodeSession({
      version: 1,
      expiresAt,
      nonce: randomBytes(16).toString("base64url"),
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/admin",
      maxAge: durationSeconds,
      expires: new Date(expiresAt),
    },
  );
}

export async function deleteAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

async function getRequestIpHash() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";

  return createHash("sha256").update(ip).digest("hex");
}

export async function reserveAdminLoginAttempt() {
  const ipHash = await getRequestIpHash();
  const windowStart = new Date(
    Date.now() -
      BUSINESS_RULES.adminSession.loginRateLimit.windowMinutes * 60 * 1000,
  ).toISOString();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("reserve_admin_login_attempt", {
    requested_ip_hash: ipHash,
    window_start: windowStart,
    maximum_attempts:
      BUSINESS_RULES.adminSession.loginRateLimit.maximumAttempts,
  });

  if (error) {
    throw new Error(`Unable to reserve login attempt: ${error.message}`);
  }

  return {
    ipHash,
    allowed: data === true,
  };
}

export async function clearFailedLogins(ipHash: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("admin_login_attempts")
    .delete()
    .eq("ip_hash", ipHash);

  if (error) {
    throw new Error(`Unable to clear login attempts: ${error.message}`);
  }
}
