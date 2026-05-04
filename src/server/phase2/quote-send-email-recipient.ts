import { CustomerContactType } from "@prisma/client";

export type ContactRow = {
  type: CustomerContactType;
  value: string;
  isPrimary: boolean;
  okToEmail: boolean;
  archivedAt: Date | null;
};

/**
 * Pick exactly one recipient email for quote send, or return a user-facing error.
 * Rules: EMAIL type, not archived, okToEmail true; disambiguate with single primary; never guess across ambiguous sets.
 */
export function resolveQuoteSendRecipientEmail(contacts: ContactRow[]): { ok: true; email: string } | { ok: false; error: string } {
  const active = contacts.filter((c) => c.archivedAt == null && c.type === CustomerContactType.EMAIL);
  const optedIn = active.filter((c) => c.okToEmail);
  if (optedIn.length === 0) {
    if (active.some((c) => !c.okToEmail)) {
      return {
        ok: false,
        error:
          "No customer email is opted in for email. Edit the customer record and enable “OK to email” on the address to use, then try again.",
      };
    }
    return {
      ok: false,
      error: "Add a customer email address and mark it OK to email before sending the proposal.",
    };
  }

  const normalize = (v: string) => v.trim().toLowerCase();
  const uniq = new Map<string, ContactRow>();
  for (const c of optedIn) {
    const e = normalize(c.value);
    if (!e || !e.includes("@")) continue;
    if (!uniq.has(e)) uniq.set(e, c);
  }
  const distinct = [...uniq.values()];
  if (distinct.length === 0) {
    return { ok: false, error: "Customer email addresses are missing or invalid." };
  }
  if (distinct.length === 1) {
    return { ok: true, email: distinct[0]!.value.trim() };
  }

  const primaries = distinct.filter((c) => c.isPrimary);
  if (primaries.length === 1) {
    return { ok: true, email: primaries[0]!.value.trim() };
  }
  if (primaries.length > 1) {
    return {
      ok: false,
      error:
        "Multiple primary email addresses are marked for this customer. Leave exactly one primary email opted in for email, then try again.",
    };
  }
  return {
    ok: false,
    error:
      "Multiple email addresses are opted in for this customer. Mark exactly one as primary (or leave only one opted-in email), then try again.",
  };
}
