import { createHmac, timingSafeEqual } from "node:crypto";

import { resolveAuthSecret } from "@/lib/auth-env";

type ScheduleActionPayload = {
  sw: string;
  tid: string;
  org: string;
};

function signingKey(): string {
  return resolveAuthSecret();
}

/**
 * HMAC-signed opaque handle for portal schedule acknowledgment.
 * Binds ScheduledWork id to portal token row and organization (verified on POST).
 */
export function signScheduleActionRef(params: {
  scheduledWorkId: string;
  portalAccessTokenId: string;
  organizationId: string;
}): string {
  const canon: ScheduleActionPayload = {
    sw: params.scheduledWorkId,
    tid: params.portalAccessTokenId,
    org: params.organizationId,
  };
  const payloadB64 = Buffer.from(JSON.stringify(canon), "utf8").toString("base64url");
  const sig = createHmac("sha256", signingKey()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

/**
 * @returns scheduledWorkId when signature and scope match; otherwise null.
 */
export function verifyScheduleActionRef(params: {
  ref: string;
  expectedPortalAccessTokenId: string;
  expectedOrganizationId: string;
}): string | null {
  const trimmed = params.ref?.trim();
  if (!trimmed) return null;
  const dot = trimmed.indexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) return null;
  const payloadB64 = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  const expectedSig = createHmac("sha256", signingKey()).update(payloadB64).digest("base64url");
  const a = Buffer.from(expectedSig, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  let parsed: ScheduleActionPayload;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as ScheduleActionPayload;
  } catch {
    return null;
  }
  if (
    typeof parsed.sw !== "string" ||
    typeof parsed.tid !== "string" ||
    typeof parsed.org !== "string" ||
    parsed.tid !== params.expectedPortalAccessTokenId ||
    parsed.org !== params.expectedOrganizationId
  ) {
    return null;
  }
  if (!parsed.sw.trim()) return null;
  return parsed.sw.trim();
}
