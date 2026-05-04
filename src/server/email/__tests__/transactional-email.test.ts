import { afterEach, describe, expect, it, vi } from "vitest";
import { describePublicAppBaseUrlForQuoteEmail, getPublicAppBaseUrl } from "@/server/email/public-app-url";
import {
  describeQuoteEmailInfrastructure,
  transactionalEmailWouldUseLiveProvider,
} from "@/server/email/transactional";

describe("public app URL", () => {
  afterEach(() => {
    delete process.env.STRUXIENT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.unstubAllEnvs();
  });

  it("prefers STRUXIENT_PUBLIC_APP_URL", () => {
    vi.stubEnv("STRUXIENT_PUBLIC_APP_URL", "https://app.example.com/path");
    expect(getPublicAppBaseUrl()).toBe("https://app.example.com");
  });

  it("requires https in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRUXIENT_PUBLIC_APP_URL", "http://insecure.example.com");
    const r = describePublicAppBaseUrlForQuoteEmail();
    expect(r.ok).toBe(false);
  });
});

describe("describeQuoteEmailInfrastructure", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns disabled when EMAIL_DELIVERY_MODE=disabled", () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "disabled");
    const r = describeQuoteEmailInfrastructure();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/disabled/i);
  });

  it("returns log mode without API key in test", () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_DELIVERY_MODE;
    const r = describeQuoteEmailInfrastructure();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe("log");
    expect(transactionalEmailWouldUseLiveProvider()).toBe(false);
  });
});
