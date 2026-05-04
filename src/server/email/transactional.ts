/**
 * Thin transactional email layer (server-only).
 * Provider: Resend HTTP API (no SDK dependency).
 *
 * Env (see `.env.example`):
 * - RESEND_API_KEY — required when delivering for real (production, or dev with EMAIL_DELIVERY_MODE=live)
 * - TRANSACTIONAL_EMAIL_FROM — e.g. "Acme Quotes <onboarding@resend.dev>"
 * - EMAIL_DELIVERY_MODE — optional: "live" | "log" | "disabled" (default: live in production, log in non-production if key missing)
 *
 * Production (NODE_ENV=production): missing provider config or disabled mode fails closed (no fake success).
 */

export type SendTransactionalEmailInput = {
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  metadata?: Record<string, string>;
};

export type SendTransactionalEmailResult =
  | { ok: true; provider: "resend"; providerMessageId: string; mode: "live" | "log" }
  | { ok: false; error: string };

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function deliveryMode(): "live" | "log" | "disabled" {
  const raw = (process.env.EMAIL_DELIVERY_MODE ?? "").trim().toLowerCase();
  if (raw === "log" || raw === "disabled" || raw === "live") return raw;
  if (isProduction()) return "live";
  return process.env.RESEND_API_KEY?.trim() ? "live" : "log";
}

function requireFromAddress(): string | null {
  const v = process.env.TRANSACTIONAL_EMAIL_FROM?.trim();
  return v || null;
}

function requireApiKey(): string | null {
  const v = process.env.RESEND_API_KEY?.trim();
  return v || null;
}

/** True when real API call would be attempted for the current mode and env. */
export function transactionalEmailWouldUseLiveProvider(): boolean {
  return deliveryMode() === "live";
}

/**
 * Whether quote email send is allowed to proceed (UI + server guard).
 * Does not validate recipient — only infrastructure.
 */
export function describeQuoteEmailInfrastructure(): { ok: true; mode: "live" | "log" } | { ok: false; message: string } {
  const mode = deliveryMode();
  if (mode === "disabled") {
    return { ok: false, message: "Email delivery is disabled (EMAIL_DELIVERY_MODE=disabled)." };
  }
  if (mode === "log") {
    return { ok: true, mode: "log" };
  }
  const from = requireFromAddress();
  const key = requireApiKey();
  if (!key) {
    if (isProduction()) {
      return { ok: false, message: "Transactional email is not configured (RESEND_API_KEY missing)." };
    }
    return { ok: false, message: "RESEND_API_KEY is not set. Use EMAIL_DELIVERY_MODE=log for local testing, or add a key." };
  }
  if (!from) {
    return {
      ok: false,
      message: isProduction()
        ? "Transactional email is not configured (TRANSACTIONAL_EMAIL_FROM missing)."
        : "TRANSACTIONAL_EMAIL_FROM is not set (e.g. \"Acme <quotes@yourdomain.com>\").",
    };
  }
  return { ok: true, mode: "live" };
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<SendTransactionalEmailResult> {
  const mode = deliveryMode();
  if (mode === "disabled") {
    return { ok: false, error: "Email delivery is disabled (EMAIL_DELIVERY_MODE=disabled)." };
  }

  const from = requireFromAddress();
  const key = requireApiKey();

  if (mode === "log") {
    console.info("[EMAIL_DELIVERY_MODE=log] transactional email (not sent)", {
      to: input.to,
      subject: input.subject,
      replyTo: input.replyTo ?? undefined,
      metadata: input.metadata,
      textPreview: input.text.slice(0, 400),
    });
    return { ok: true, provider: "resend", providerMessageId: "log-mode-no-provider-id", mode: "log" };
  }

  if (!key || !from) {
    if (isProduction()) {
      return {
        ok: false,
        error: "Email is not configured for this environment. Set RESEND_API_KEY and TRANSACTIONAL_EMAIL_FROM.",
      };
    }
    return {
      ok: false,
      error:
        "Email is not configured. Set RESEND_API_KEY and TRANSACTIONAL_EMAIL_FROM, or set EMAIL_DELIVERY_MODE=log for development.",
    };
  }

  const body: Record<string, unknown> = {
    from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
  };
  if (input.replyTo?.trim()) {
    body.reply_to = input.replyTo.trim();
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
  if (!res.ok) {
    const msg =
      typeof json?.message === "string"
        ? json.message
        : typeof json?.name === "string"
          ? json.name
          : `Email provider returned HTTP ${res.status}`;
    return { ok: false, error: msg.slice(0, 500) };
  }
  const id = typeof json?.id === "string" ? json.id : "";
  if (!id) {
    return { ok: false, error: "Email provider response did not include a message id." };
  }
  return { ok: true, provider: "resend", providerMessageId: id, mode: "live" };
}
