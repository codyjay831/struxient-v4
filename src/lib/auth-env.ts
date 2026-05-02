/**
 * Canonical secret resolution for Auth.js across middleware (Edge) and Node (route handlers, RSC).
 *
 * - Prefer AUTH_SECRET (Auth.js v5 / Phase 0 standard).
 * - Fall back to NEXTAUTH_SECRET only for local migration from NextAuth v4-era env files.
 * - Reject blank strings so an empty AUTH_SECRET does not block NEXTAUTH_SECRET fallback
 *   (Auth.js would otherwise treat "" as "set" and skip inference).
 */
export function resolveAuthSecret(): string {
  const primary = process.env.AUTH_SECRET?.trim();
  if (primary) return primary;

  const legacy = process.env.NEXTAUTH_SECRET?.trim();
  if (legacy) return legacy;

  throw new Error(
    "Auth configuration error: AUTH_SECRET is missing or empty. Set AUTH_SECRET in .env (see .env.example). " +
      "Generate a value with: openssl rand -base64 32. " +
      "If you are migrating from NextAuth v4, you may temporarily use NEXTAUTH_SECRET instead, but standardize on AUTH_SECRET.",
  );
}
