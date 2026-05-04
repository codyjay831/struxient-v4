import { describe, expect, it } from "vitest";
import { CustomerContactType } from "@prisma/client";
import { resolveQuoteSendRecipientEmail } from "@/server/phase2/quote-send-email-recipient";

describe("resolveQuoteSendRecipientEmail", () => {
  it("fails when no opted-in email", () => {
    const r = resolveQuoteSendRecipientEmail([
      {
        type: CustomerContactType.EMAIL,
        value: "a@b.com",
        isPrimary: true,
        okToEmail: false,
        archivedAt: null,
      },
    ]);
    expect(r.ok).toBe(false);
  });

  it("uses sole opted-in email", () => {
    const r = resolveQuoteSendRecipientEmail([
      {
        type: CustomerContactType.EMAIL,
        value: "  Sole@Example.com ",
        isPrimary: false,
        okToEmail: true,
        archivedAt: null,
      },
    ]);
    expect(r).toEqual({ ok: true, email: "Sole@Example.com" });
  });

  it("uses primary when multiple opted-in", () => {
    const r = resolveQuoteSendRecipientEmail([
      {
        type: CustomerContactType.EMAIL,
        value: "a@x.com",
        isPrimary: false,
        okToEmail: true,
        archivedAt: null,
      },
      {
        type: CustomerContactType.EMAIL,
        value: "b@x.com",
        isPrimary: true,
        okToEmail: true,
        archivedAt: null,
      },
    ]);
    expect(r).toEqual({ ok: true, email: "b@x.com" });
  });

  it("fails when multiple opted-in and no primary", () => {
    const r = resolveQuoteSendRecipientEmail([
      {
        type: CustomerContactType.EMAIL,
        value: "a@x.com",
        isPrimary: false,
        okToEmail: true,
        archivedAt: null,
      },
      {
        type: CustomerContactType.EMAIL,
        value: "b@x.com",
        isPrimary: false,
        okToEmail: true,
        archivedAt: null,
      },
    ]);
    expect(r.ok).toBe(false);
  });
});
