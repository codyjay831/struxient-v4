# Struxient v4 Customer Portal MVP

## Purpose

Define **minimum viable customer portal**: secure entry, **filtered projection** of internal workflow truth, and core actions—aligned with [08-customer-view](../execution-workflow/08-customer-view.md) and [MVP 5](../../planning/struxient-v4-mvp-scope-and-build-order.md).

**CANON:** Portal = **same underlying model**, **customer-safe** presentation—not a disconnected second workflow.  
**ASSUMPTION:** Change order approval in portal may be **phase 1.5** after quote approve.

---

## Entry methods (conceptual)

- **Magic link** / secure one-time link (email/SMS).  
- **Account** login (email + password / passkey) — implementation later.  
- **Project-scoped** token with expiry and rate limits.

---

## Auth / security model (conceptual)

- Token or session proves **customer identity + scope** (which quote/job).  
- **Least privilege:** APIs return only **customer-visible** fields.  
- **Server-side** enforcement; hiding UI is not security ([security](../security/struxient-v4-permissions-matrix.md)).

---

## Customer home (MVP)

- Active **project** or quote name.  
- **Milestones** status strip.  
- **Pending actions** (upload, confirm window, approve quote).

---

## Quote view / approval (MVP)

- See **proposal** as customer will see it ([12](../execution-workflow/12-quote-authoring-ux-and-readiness.md) preview parity).  
- **Accept / sign / approve** (as legally/process allows—product/legal review).  

---

## Upload requests

- Panel photo, site access photo, etc., with **labels** ([evidence](../evidence/struxient-v4-attachments-photos-evidence.md)).

---

## Availability confirmation

- Pick/confirm windows; ties to scheduling canon ([13](../execution-workflow/13-calendar-and-scheduling-model.md)).

---

## Milestones / status

Mapped internal progress → friendly labels ([08](../execution-workflow/08-customer-view.md)).

---

## Schedule appointments (MVP optional)

- Show **confirmed** or **requested** windows if enabled; not internal crew conflict grid.

---

## Change order approval (later)

- Stub in MVP if needed; full flow post-MVP 5.

---

## Messages / comments (later)

- MVP may be **email** only; in-app thread later ([communication](../communication/struxient-v4-requests-messages-notifications.md)).

---

## What customers must **not** see

- Margin, internal notes, internal task names (unless mapped), supplier costs, staff-only risk notes, discount approval chains.

---

## Redaction rules (canon)

| Internal | Customer |
|----------|----------|
| Line item + customer description | Same line, customer fields only |
| Internal task “Submit permit” | Milestone “Permit in progress” |
| Margin % | Hidden |

---

## Open questions

- PDF download vs web-only?  
- Multi-job customer dashboard?

---

## Implementation later

- Watermarked PDF; e-sign integration; audit of customer actions.

---

*Planning canon only.*
