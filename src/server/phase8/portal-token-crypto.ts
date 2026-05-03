import { createHash, randomBytes } from "node:crypto";

/** 256-bit URL-safe secret; never log or persist raw value beyond one-time staff handoff. */
export function generateRawPortalToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Deterministic storage for high-entropy bearer tokens (SHA-256 hex digest). */
export function hashPortalToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
