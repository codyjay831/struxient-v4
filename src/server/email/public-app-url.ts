/**
 * Absolute public origin for customer-facing links (portal, proposal email).
 * Server-only — use STRUXIENT_PUBLIC_APP_URL (preferred) or NEXT_PUBLIC_APP_URL.
 */

export function getPublicAppBaseUrl(): string | null {
  const a = process.env.STRUXIENT_PUBLIC_APP_URL?.trim();
  const b = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const raw = a || b || "";
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function describePublicAppBaseUrlForQuoteEmail(): { ok: true; origin: string } | { ok: false; message: string } {
  const origin = getPublicAppBaseUrl();
  if (!origin) {
    return {
      ok: false,
      message:
        "Public app URL is not set. Configure STRUXIENT_PUBLIC_APP_URL (recommended) or NEXT_PUBLIC_APP_URL so customer links use the correct domain.",
    };
  }
  if (process.env.NODE_ENV === "production" && origin.startsWith("http://")) {
    return { ok: false, message: "Production requires an https STRUXIENT_PUBLIC_APP_URL / NEXT_PUBLIC_APP_URL." };
  }
  return { ok: true, origin };
}

export function absolutePortalUrl(portalPath: string): string | null {
  const base = getPublicAppBaseUrl();
  if (!base) return null;
  const path = portalPath.startsWith("/") ? portalPath : `/${portalPath}`;
  return new URL(path, base).toString();
}
