# Phase 2 — Quote Workspace MVP (Implementation Plan)

## Purpose

This document is the **detailed implementation plan for Phase 2 only**: the first **real Quote Workspace MVP** where the quote is the **primary authority** for draft authoring, commercial scope, dormant execution planning, readiness, internal preview of the customer-facing proposal, and controlled status transitions **before** sold execution.

It is intended for **review before any code is written**.

**Mode:** Planning only. **No** application code, **no** Prisma schema, **no** migrations, **no** new routes/components, **no** package installs, **no** runtime behavior changes are made by authoring this document.

**Global rule:** **Minimal is acceptable. Temporary is not.** No throwaway demo UX, duplicate quote/scope truth, insecure shortcuts, hidden dev-mode flows, or client-only security.

**Upstream plans:**

- [struxient-v4-full-phase-implementation-plan.md](./struxient-v4-full-phase-implementation-plan.md) — Phase 2 summary, handoff from Phase 1, acceptance themes  
- [struxient-v4-clean-slate-implementation-blueprint.md](./struxient-v4-clean-slate-implementation-blueprint.md) — route blueprint, conceptual models, events MVP, first vertical slice  
- [phase-1-customers-opportunities-lead-intake-plan.md](./phase-1-customers-opportunities-lead-intake-plan.md) — customers, opportunities, **readiness toward quote draft**, opportunity activity; quote row/workspace deferred to Phase 2 per that plan  

**Canon / architecture references:**

- [03-quote-to-execution-model](../architecture/execution-workflow/03-quote-to-execution-model.md)  
- [06-sales-vs-sold-execution](../architecture/execution-workflow/06-sales-vs-sold-execution.md)  
- [07-task-dimensions](../architecture/execution-workflow/07-task-dimensions.md)  
- [08-customer-view](../architecture/execution-workflow/08-customer-view.md)  
- [11-lead-intake-to-quote-creation](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md)  
- [12-quote-authoring-ux-and-readiness](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)  
- [app-shell README](../architecture/app-shell/README.md), [01-left-navigation-model](../architecture/app-shell/01-left-navigation-model.md), [05-surface-ownership-map](../architecture/app-shell/05-surface-ownership-map.md), [03-role-based-navigation-and-visibility](../architecture/app-shell/03-role-based-navigation-and-visibility.md), [04-login-auth-and-portal-model](../architecture/app-shell/04-login-auth-and-portal-model.md)  
- [struxient-v4-entity-map](../architecture/data-model/struxient-v4-entity-map.md)  
- [struxient-v4-permissions-matrix](../architecture/security/struxient-v4-permissions-matrix.md)  
- [struxient-v4-attachments-photos-evidence](../architecture/evidence/struxient-v4-attachments-photos-evidence.md) — carry-forward / defer deep uploads  
- [struxient-v4-finance-and-payment-gates](../architecture/finance/struxient-v4-finance-and-payment-gates.md) — context only; **no** payment gates or collection in Phase 2  

---

## 1. Phase 2 goal

Deliver the **first real Quote Workspace** so internal staff can:

- **Author** a quote as the **commercial + operational blueprint** ([03](../architecture/execution-workflow/03-quote-to-execution-model.md), [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)).  
- Maintain **customer + job context**, **line items** (commercial scope), **pricing basics**, **assumptions**, **quote-prep tasks**, and **planned execution tasks** in **one workspace** under Sales.  
- See **server-derived readiness** (draft vs send thresholds) with clear blockers, severities, and fix locations.  
- Open an **internal customer preview MVP** — customer-safe projection only ([08](../architecture/execution-workflow/08-customer-view.md)).  
- **Mark Ready to Send** and **Mark Sent** when rules allow, with **server-enforced** transitions (not UI-only).  
- Rely on **append-only quote activity** for explainability and future Work Station / audit needs.

### 1.1 Canon preserved in Phase 2 (must hold)

| Canon | Phase 2 meaning |
|-------|------------------|
| Quote = commercial + operational blueprint | Workspace edits header, lines, tasks, assumptions together. |
| Quote workspace = main quote-authoring authority | **No** `/scope` or parallel “real scope” page as competing truth ([12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)). |
| Line items own commercial scope | Pricing, optional/alternate/allowance modes, customer-facing descriptions live on lines. |
| Tasks own execution detail; stages organize timing | `stageKey` on quote tasks is planning metadata; no runtime stage engine. |
| Quote-prep ≠ runtime job tasks | `QuoteTask.kind = QUOTE_PREP` never becomes `RuntimeTask` in Phase 2 (no jobs). |
| Planned execution is dormant until sold/activated | `QuoteTask.kind = PLANNED_EXECUTION` is plan-only; no job board, no activation ([06](../architecture/execution-workflow/06-sales-vs-sold-execution.md)). |

### 1.2 Locked decisions (this phase)

- **Create real `Quote` records** in Phase 2 (and related child rows as planned below).  
- **Create quote from opportunity** only when **readiness allows** or under an **explicit policy** for allowed warnings (documented server-side; auditable if warnings waived).  
- **Quote workspace route** under Sales: **`/app/sales/quotes/[quoteId]`**.  
- **Opportunity detail** exposes a real **“Create quote draft”** (or equivalent) action once Phase 2 ships, linking to the new quote.  
- **Carry-forward** from opportunity/customer: customer, opportunity, service address/context, scope intent, relevant intake facts (see §7).  
- **Line items + planned execution** live in the **same** workspace; optional **focused planning** UI is **inside** the quote workspace only ([12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md) “secondary lens”).  
- **Customer preview** = **internal** preview MVP of what a future customer-facing proposal would include — **not** a customer portal (Phase 7).

### 1.3 Explicitly not implemented in Phase 2

- Job activation, **`Job`** model (unless unavoidable due to pre-existing code — assume **not** required), **`RuntimeTask`**.  
- Customer portal, e-sign, payment processing, full finance/invoicing ([finance](../architecture/finance/struxient-v4-finance-and-payment-gates.md) execution deferred).  
- Catalog packets, FlowSpec builder, outcome rule engine, change orders.  
- Scheduling/calendar.  
- Upload/evidence pipeline **beyond** carrying context fields already on customer/opportunity/quote as designed in Phase 1/2 (no new storage pipeline).  
- Work Station real feed (Phase 5).  
- AI quoting.

---

## 2. Route ownership and IA

**Sales** owns quote **draft** and **pre-send** authoring ([01](../architecture/app-shell/01-left-navigation-model.md), [05](../architecture/app-shell/05-surface-ownership-map.md)). **Customers** remains the relationship anchor; customer detail may **link** to quotes for navigation later, but the **authoring surface** lives under **`/app/sales/quotes/*`**.

| Route | Purpose |
|-------|---------|
| `/app/sales/quotes/[quoteId]` | **Primary** quote workspace (header, context, lines, tasks, pricing/assumptions, readiness, preview, activity). |
| `/app/sales/quotes` | **Optional** list view — implement only if product needs global quote discovery in Phase 2; otherwise **defer** and rely on opportunity ↔ quote links to avoid overbuilding. |
| `/app/sales/opportunities/[opportunityId]` | **Handoff**: “Create quote draft” when allowed; show **link** to created quote(s). |
| `/app/customers/[customerId]` | May show **links** to quotes; no competing authoring surface. |

**Security:** Same protected `/app` layout as Phase 0/1. **Crew lead / field** must receive **403** on quote mutations and sensitive reads even if they obtain a URL ([03](../architecture/app-shell/03-role-based-navigation-and-visibility.md), [permissions matrix](../architecture/security/struxient-v4-permissions-matrix.md)).

---

## 3. Data model planning (conceptual Prisma-level)

All names are **conceptual** until schema review. Every business row includes **`organizationId`** for tenant isolation. **Foreign keys** must enforce **Customer** and **Opportunity** belonging to the **same organization** as the **Quote**.

### 3.1 `Quote`

| | |
|--|--|
| **Purpose** | Single row representing one commercial + operational blueprint in progress or sent ([entity map](../architecture/data-model/struxient-v4-entity-map.md)). |
| **Key fields** | `organizationId`; `customerId`; `opportunityId`; **`quoteNumber`** or human-readable **`displayNumber`** (org-scoped uniqueness strategy — open decision §16); **`status`** (enum §5); **`title`**; **service address snapshot or structured snapshot** + optional `serviceAddressTbd` carried from opportunity; **`scopeSummary`** / **`scopeIntent`** carry-forward from opportunity; **`customerNotes`** / **`customerFacingIntro`** (optional); **`internalNotes`** (optional); **`pricingSubtotalCents`** / **`totalCents`** if denormalized for performance; **`sentAt`** (nullable); **`createdById`**; **`ownerUserId`** (optional); timestamps. |
| **Relationships** | N→1 `Organization`, `Customer`, `Opportunity`; 1→N `QuoteLineItem`, `QuoteTask`, `QuoteActivityEvent`; optional 1→N `QuoteAssumption` if modeled separately (§3.6). |
| **MVP needed?** | **Yes.** |
| **Later expansion** | `QuoteVersion` / revision graph (Phase 3); payment terms; tax breakdown; snapshot-at-send row; catalog template ids; FlowSpec links. |

### 3.2 `QuoteStatus` (enum)

Suggested values (align naming with Prisma conventions at implementation):

- `DRAFT`  
- `MISSING_INFO`  
- `NEEDS_REVIEW`  
- `READY_TO_SEND`  
- `SENT`  
- `REVISED`  
- `DECLINED`  

**Phase 3 note:** Do **not** add `SIGNED` / `ACCEPTED` for Phase 2 UI unless the enum reserves values for forward compatibility **without** transitions implemented here.

### 3.3 `QuoteLineItem`

| | |
|--|--|
| **Purpose** | **Commercial scope** owner: what is sold and for how much ([03](../architecture/execution-workflow/03-quote-to-execution-model.md)). |
| **Key fields** | `organizationId`; `quoteId`; **`title`**; **`customerDescription`**; **`quantity`** (decimal or int per product rule); **`unitPriceCents`** and/or **`lineTotalCents`** (document formula: fixed price vs calculated); **`pricingMode`** (enum §3.4); **`taxable`** optional; **`sortOrder`**; **`lineMode`** / status: `REQUIRED` \| `OPTIONAL` \| `ALTERNATE` \| `ALLOWANCE` \| `REMOVED` (see §5); **`internalNotes`**; **line-level assumptions** (text or FK to `QuoteAssumption`); timestamps. |
| **Relationships** | N→1 `Quote`; optional 1→N `QuoteTask` (planned execution or prep linked to line). |
| **MVP needed?** | **Yes.** |
| **Later expansion** | Catalog line template reference + snapshot ids; discounts; outcome rules; customer-selectable options. |

### 3.4 `PricingMode` (enum)

- `FIXED_PRICE`  
- `PRICE_ON_REQUEST`  
- `ALLOWANCE`  
- `INCLUDED`  
- `NO_CHARGE`  

Readiness rules must treat non-fixed modes explicitly (§9).

### 3.5 `QuoteTask`

| | |
|--|--|
| **Purpose** | Unified table for **quote-prep** (sales lane) and **planned execution** (dormant plan) distinguished by **`kind`** ([06](../architecture/execution-workflow/06-sales-vs-sold-execution.md), [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)). |
| **Key fields** | `organizationId`; `quoteId`; **`quoteLineItemId`** optional; **`kind`**: `QUOTE_PREP` \| `PLANNED_EXECUTION` (`QuoteTaskKind`); **`stageKey`** optional (string or small enum — keep simple in Phase 2); **`title`**; **`description`**; **`status`** (`QuoteTaskStatus` §5); **`isRequired`**; **`sortOrder`**; **`assignedRole`** optional; **`estimatedDurationMinutes`** optional; **`customerVisible`** boolean; **`customerLabel`** optional; **`internalNotes`** optional; timestamps. |
| **Relationships** | N→1 `Quote`; optional N→1 `QuoteLineItem`. |
| **MVP needed?** | **Yes.** |
| **Later expansion** | Dependencies, proof requirements, materials linkage ([07](../architecture/execution-workflow/07-task-dimensions.md)); activation mapping keys for Phase 4. |

### 3.6 Assumptions: model vs fields

| Option | When to choose |
|--------|----------------|
| **Fields on `Quote` / `QuoteLineItem`** | Smallest Phase 2; few assumptions; simple MVP. |
| **`QuoteAssumption` rows** | Multiple customer-visible vs internal assumptions; sorting; readiness ties per row; cleaner projection for customer preview. |

**If `QuoteAssumption` model:** `organizationId`; `quoteId`; `quoteLineItemId` optional; **`visibility`**: `CUSTOMER_VISIBLE` \| `INTERNAL_ONLY`; **`text`**; **`sortOrder`**; timestamps.

**Recommendation:** Prefer **`QuoteAssumption`** table if more than one or two assumptions per quote are expected early; otherwise structured text on quote + line with clear projection rules.

### 3.7 `QuoteActivityEvent`

| | |
|--|--|
| **Purpose** | Append-only history for quote ([05](../architecture/execution-workflow/05-deterministic-execution-engine.md) spirit, [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md) §9). |
| **Key fields** | `organizationId`; `quoteId`; `opportunityId` optional; `customerId` optional; `actorUserId` optional; **`eventType`** (enum §12); **`summary`**; **`payload`** JSON optional; **`createdAt`**. |
| **Relationships** | N→1 `Quote`; optional links for timeline queries. |
| **MVP needed?** | **Yes** for listed mutations. |
| **Later expansion** | Correlation ids; portal-originated events; integration events. |

### 3.8 `QuoteReadiness`

**Do not** persist as authoritative source of truth. **Prefer** pure server function `evaluateQuoteReadiness(quoteId, ctx)` returning a DTO. Optional **cache** table only if performance requires it — if used, treat as **derived** and always invalidatable.

---

## 4. State planning

### 4.1 Quote lifecycle (Phase 2)

Statuses: `DRAFT`, `MISSING_INFO`, `NEEDS_REVIEW`, `READY_TO_SEND`, `SENT`, `REVISED`, `DECLINED`.

**Editing rules (planning):**

- **Editable** (header, lines, tasks, assumptions) while status is **`DRAFT`**, **`MISSING_INFO`**, **`NEEDS_REVIEW`**, **`READY_TO_SEND`** — subject to validation and permission.  
- **`SENT`**: **No casual edits** — server rejects mutations **or** only allows a documented **minimal revision path** (open decision §16). Phase 3 owns full revision UX; Phase 2 must **not** silently allow mutating sent commercial truth.  
- **`REVISED` / `DECLINED`**: minimal behavior acceptable if enums exist; deeper lifecycle in Phase 3.

**Derived status vs stored:** Optionally map **`MISSING_INFO`** / **`NEEDS_REVIEW`** from readiness on save **or** maintain explicit transitions; either way, **readiness checklist** remains the user-visible source of “what’s wrong” ([12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)).

### 4.2 Line item modes

`REQUIRED`, `OPTIONAL`, `ALTERNATE`, `ALLOWANCE`, `REMOVED` — affect readiness (e.g., `REMOVED` excluded from “active line” count) and totals.

### 4.3 `QuoteTaskStatus`

`NOT_READY`, `READY`, `IN_PROGRESS`, `BLOCKED`, `WAITING`, `NEEDS_REVIEW`, `COMPLETE`, `SKIPPED`, `CANCELED` — aligned with blueprint / task dimensions naming at schema review.

**Invariant:** Changing task status **never** creates runtime job work in Phase 2.

---

## 5. Quote creation from opportunity

### 5.1 Server action

**`createQuoteDraftFromOpportunity(opportunityId)`** (name illustrative).

### 5.2 Rules

1. **Authenticated** session; **`organizationId`** from membership — **never** trust client org id.  
2. **Role:** `OWNER`, `ADMIN`, `MANAGER`, `OFFICE`, `SALES` — align with matrix ([struxient-v4-permissions-matrix](../architecture/security/struxient-v4-permissions-matrix.md)); **deny** crew/field.  
3. **Opportunity** must exist in org; **customer** must exist in org and match opportunity.  
4. **Opportunity status** must **not** be terminal **`LOST`** / **`NO_QUOTE`** / **`ARCHIVED`** (exact enum values from Phase 1 implementation).  
5. **Readiness:** Call **Phase 1** (or shared) **`evaluateOpportunityReadinessForQuoteDraft`** — if **blockers** exist: **either** reject creation **or** allow creation only with **`explicitWarningsAcknowledged`** payload and policy flag (product decision); any waiver must write **activity** on opportunity and quote.  
6. **Copy / snapshot** onto quote: `customerId`, `opportunityId`, **title** (from opportunity title or template), **serviceType**, **service address** fields or **TBD** flag, **scopeIntent** / scope summary, **desiredTimeline** if captured, **sales owner** optional copy to `ownerUserId`. **Contact:** prefer **reference** to customer contacts; avoid duplicating email/phone **unless** a deliberate “snapshot at quote create” policy is chosen for future portal parity (open decision §16).  
7. **Events:** Insert **`QuoteActivityEvent`**: e.g. `QUOTE_DRAFT_CREATED`; insert **`OpportunityActivityEvent`**: `QUOTE_DRAFT_CREATED_FROM_OPPORTUNITY` (or reuse `QUOTE_DRAFT_CREATED` with payload discriminator).  
8. **Opportunity status:** If Phase 1 defines **`Quote Draft Created`**, transition opportunity to that status when quote row exists (open decision §16).  
9. **Return** `quoteId` for redirect to **`/app/sales/quotes/[quoteId]`**.

---

## 6. Quote workspace UX plan (conceptual sections)

**Visual system:** Dark-only, **shadcn/ui**, Tailwind, **lucide-react** sparingly; **black** primary background, **blue** accent, **sharp/tight** radius; dense, professional contractor operations aesthetic — no starter-template marketing chrome, no playful empty states, no “coming soon” developer voice ([Phase 1 plan](./phase-1-customers-opportunities-lead-intake-plan.md) §12, [app-shell](../architecture/app-shell/README.md)).

The user should always see: **what is missing**, **what to do next**, **what blocks send**, **what the customer will see** ([12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)).

### 6.1 Header / status

Quote title, customer name, **link to opportunity**, **status badge**, **total** (where computable), **readiness headline** (e.g. send-blocked vs ready), **primary CTA** (resolve blockers → preview → mark ready → send).

### 6.2 Customer + job context

Customer summary, **contact summary** (from customer record), service address / **scope intent** (from quote snapshot), internal context; **deep links** back to customer and opportunity.

### 6.3 Line items

Add / edit / remove (or mark `REMOVED`); fields per §3.3; show **line total**; respect **line mode** and **pricing mode** in UI copy.

### 6.4 Planned execution

List **`PLANNED_EXECUTION`** tasks; add/edit; optional `stageKey`; link to line or quote; **no** drag-drop workflow builder; **no** runtime behavior.

### 6.5 Quote-prep / internal review

List **`QUOTE_PREP`** tasks; use for “needs review” flows; **no** separate approval engine — completeness + status drives readiness.

### 6.6 Pricing + assumptions

Subtotal/total from lines where modes allow; show **non-fixed** pricing clearly (“Allowance — see assumptions”). **Margin / cost:** **defer** unless already present from earlier work; if present, **role-gate** per matrix.

### 6.7 Readiness / send checklist

Server-derived list (§9); each item: **key**, **label**, **status**, **severity**, **fixLocation**, **explanation**.

### 6.8 Customer preview (internal)

Dedicated panel or route **segment** still under auth (e.g. tab with explicit **“Internal preview”** label). Copy: **“This is what the customer-facing proposal will include.”** Not a dev placeholder.

### 6.9 Activity / history

Chronological **`QuoteActivityEvent`** list; filters optional later.

---

## 7. Readiness MVP (server-derived)

**Function:** `evaluateQuoteSendReadiness(quote, lines, tasks, customer, opportunity, policyCtx) → ReadinessChecklistDTO`.

Each item:

| Property | Description |
|----------|-------------|
| `key` | Stable machine key |
| `label` | Short UI label |
| `status` | `PASS` \| `FAIL` \| `WAIVED` \| `NOT_APPLICABLE` |
| `severity` | `BLOCKER` \| `WARNING` \| `INFO` |
| `fixLocation` | Section key for deep link / scroll target |
| `explanation` | Human-readable reason |

### 7.1 Suggested checks (Phase 2 deterministic set)

| key | Rule (conceptual) | Default severity |
|-----|-------------------|------------------|
| `quote_customer` | Quote has `customerId` in org | BLOCKER |
| `quote_opportunity` | Quote has `opportunityId` in org | BLOCKER |
| `sendable_contact` | Customer has sendable contact **or** documented waiver from Phase 1 policy | BLOCKER |
| `active_lines` | At least one line with mode ≠ `REMOVED` | BLOCKER |
| `line_title` | Required lines have non-empty title | BLOCKER |
| `line_quantity` | No invalid/zero quantity where quantity applies | BLOCKER |
| `line_price_fixed` | `REQUIRED` + `FIXED_PRICE` implies price present | BLOCKER |
| `customer_description` | Required-for-send lines have customer description | BLOCKER |
| `customer_intro_terms` | If policy requires intro/terms/disclaimer fields — present | BLOCKER |
| `quote_prep_required` | Required `QUOTE_PREP` tasks are `COMPLETE` (or allowed skip policy) | BLOCKER |
| `internal_review` | Quote status or tasks imply review — satisfied | BLOCKER |
| `planned_execution` | If org policy requires ≥1 `PLANNED_EXECUTION` task before send — enforce or **WARN** only (default Phase 2: **WARN** unless configured) | WARNING |
| `non_fixed_pricing_clarity` | `PRICE_ON_REQUEST` / `ALLOWANCE` lines have customer-facing explanation or linked assumption | WARNING |

**Waived** paths must be explicit and auditable when implemented.

**Quote status sync:** Optionally set `MISSING_INFO` / `NEEDS_REVIEW` from checklist aggregate on save — document chosen rule to avoid mismatch between badge and checklist.

---

## 8. Actions / APIs plan (server-side)

All actions: **session required**, **org from server**, **role check**, **Zod** (or equivalent) validation, **`where: { organizationId, id }`** on all reads/writes, **no** trusting client tenant id, **customer preview** built from **server projection** only.

| Action | Purpose |
|--------|---------|
| `createQuoteDraftFromOpportunity` | §5 |
| `updateQuote` | Header/context fields, customer-facing intro, internal notes (permissioned) |
| `addQuoteLineItem` / `updateQuoteLineItem` / `removeQuoteLineItem` | Line CRUD or soft-remove via mode |
| `addQuoteTask` / `updateQuoteTask` / `updateQuoteTaskStatus` | Both kinds; status transitions validated |
| `addQuoteAssumption` / `updateQuoteAssumption` | If assumption model used |
| `markQuoteReadyToSend` | Validates readiness blockers empty; sets status server-side; logs activity |
| `markQuoteSent` | Stricter checks (may equal ready + confirmation); sets `SENT`, `sentAt`; logs `QUOTE_SENT` |
| `recordQuoteActivity` | Internal helper for consistent inserts |
| `getQuoteCustomerPreview` | Returns **preview DTO only** (§11) |

**Reads:** `getQuoteForWorkspace`, `listQuotesByOpportunity` (if multi-quote supported), etc. — all org-scoped.

**Forbidden:** Status transitions **only** in client state; **always** persist via server actions with validation.

---

## 9. Permission plan

- **Tenant isolation:** Every query/mutation filters by session `organizationId`.  
- **Cross-org id:** 404/403 — avoid enumeration.  
- **Roles allowed** for quote authoring: **OWNER, ADMIN, MANAGER, OFFICE, SALES** (tune “office limited” per matrix **L** cells at implementation).  
- **CREW_LEAD / FIELD_WORKER:** **Deny** quote authoring routes and actions at **server** regardless of nav visibility ([03](../architecture/app-shell/03-role-based-navigation-and-visibility.md)).  
- **Sensitive fields:** `internalNotes`, internal-only assumptions, margin/cost (if ever added), **`QUOTE_PREP`** tasks, **`PLANNED_EXECUTION`** internal details — **omit** from `getQuoteCustomerPreview` DTO.  
- **Customer-visible** flags on tasks: preview may show only tasks marked `customerVisible` with `customerLabel` — default **hide** all quote-prep tasks from preview.

---

## 10. Events

### 10.1 `QuoteActivityEvent` types (suggested)

`QUOTE_DRAFT_CREATED`, `QUOTE_UPDATED`, `QUOTE_LINE_ADDED`, `QUOTE_LINE_UPDATED`, `QUOTE_LINE_REMOVED`, `QUOTE_TASK_ADDED`, `QUOTE_TASK_UPDATED`, `QUOTE_TASK_COMPLETED`, `QUOTE_ASSUMPTION_ADDED`, `QUOTE_ASSUMPTION_UPDATED`, `QUOTE_PREVIEWED`, `QUOTE_MARKED_READY`, `QUOTE_SENT`, `QUOTE_STATUS_CHANGED`.

### 10.2 Opportunity event

`QUOTE_DRAFT_CREATED_FROM_OPPORTUNITY` (or equivalent) on successful create from opportunity.

---

## 11. Customer preview MVP DTO (server-only)

**Include:** org/company display name; quote title; customer display name; service address / scope summary; line items (title, customer description, quantity, **customer-visible** pricing presentation, customer-visible assumptions); subtotal/total where meaningful; customer-facing intro/notes; quote status label appropriate for external wording; date.

**Exclude:** internal notes; quote-prep tasks; planned execution internal detail; internal-only assumptions; margin/cost/supplier breakdown; full activity history; readiness blockers; sales owner internal commentary.

**Tests:** Golden / snapshot tests on DTO shape and **absence** of forbidden keys.

---

## 12. Testing plan

Reuse Phase 0/1 test patterns if present.

| Area | Test idea |
|------|-----------|
| Creation | `createQuoteDraftFromOpportunity` respects org; cross-org opportunity **fails** |
| Reads | Quote by id in org A not readable from org B |
| Mutations | Line/task updates scoped by `organizationId` |
| Preview | DTO contains **no** internal notes / internal-only assumptions |
| Readiness | Deterministic outputs for fixture quotes (blockers / warnings) |
| Sent lock | `SENT` quote rejects `updateQuote` / line mutations unless revision policy explicitly allows |
| Auth | Unauthenticated redirect; unauthorized role 403 |

---

## 13. Acceptance criteria

- [ ] User can **create quote draft** from an **eligible** opportunity (per §5).  
- [ ] Opportunity detail **links** to created quote and shows **Create quote draft** when readiness/policy allows.  
- [ ] Quote workspace loads at **`/app/sales/quotes/[quoteId]`**.  
- [ ] User can edit **quote header / context** fields.  
- [ ] User can **add / edit / remove** line items.  
- [ ] User can **add / edit** quote-prep and planned execution tasks (kinds distinguished).  
- [ ] **Readiness checklist** updates deterministically from server evaluation.  
- [ ] **Customer preview** shows **customer-safe** content only.  
- [ ] User can **Mark Ready to Send** when no blockers (policy-defined).  
- [ ] User can **Mark Sent** when send readiness passes; **`sentAt`** set; activity recorded.  
- [ ] **Sent** quote cannot be casually edited (server-enforced or explicit minimal revision — documented).  
- [ ] **Activity events** recorded for key actions.  
- [ ] **Tenant** and **role** enforcement verified.  
- [ ] **Customers / Sales** nav still coherent with Phase 1.  
- [ ] **No** `Job` / `RuntimeTask` created.  
- [ ] **No** customer portal routes.  
- [ ] **Build / lint / test** pass.

---

## 14. Explicitly out of scope

Same as §1.3; additionally: full tax engine, automated email send, PDF generation, legal e-sign, multi-currency.

---

## 15. Risks and drift warnings

| Risk | Mitigation |
|------|------------|
| **Quote / scope split** returns | Code review: no second authoritative scope surface; deep links into quote sections only. |
| **Planned execution treated as runtime** | Naming, UI labels, and **kind** enum in schema + server guards; Phase 4 activation is the only promotion path. |
| **Sent quote edited** without revision | Server mutation guards; explicit `SENT` policy in §4.1 / §16. |
| **Customer preview leaks** internal data | One projection function; automated negative tests. |
| **Pricing overbuilt** | Fixed modes + simple totals first; defer tax/margin complexity. |
| **Readiness only in UI** | Server DTO is source for checklist and send gates. |
| **Weak tenant scoping** | Two-org integration tests on all new actions. |
| **Quotes from lost opps** | Hard rule in §5. |
| **Multiple quotes per opportunity** unclear | Decide §16; enforce unique “primary” in UI if needed. |
| **No activity history** | Require `QuoteActivityEvent` on all listed mutations. |

---

## 16. Open decisions (pre-implementation)

1. **`OpportunityStatus`:** Add / use **`QUOTE_DRAFT_CREATED`** (or Phase 1’s **“Quote Draft Created”**) in the **same** migration pass as quote tables, or transition opportunity only via subquery on quotes — **pick one** to avoid orphaned states.  
2. **Multiple quotes per opportunity:** Allow **N** quotes in Phase 2 vs **one active draft** per opportunity — affects list UI and create button guard.  
3. **`QuoteVersion` / snapshot at send:** **Defer** to Phase 3 vs minimal **`sentSnapshotJson`** on quote — affects audit and CO later.  
4. **Assumptions:** Dedicated **`QuoteAssumption`** table vs text fields — §3.6.  
5. **Contact snapshot** at quote create vs **live** customer contact for preview/send — parity vs drift tradeoff.  
6. **Tax / margin / payment fields** on quote lines — **defer** unless required for display; align with [finance](../architecture/finance/struxient-v4-finance-and-payment-gates.md) later.  
7. **Planned execution before send:** **BLOCKER** vs **WARNING** default — §7.1.  
8. **`SENT` edit policy:** Hard deny all structural edits vs allow **non-commercial** fields (internal notes) vs **`startRevision`** stub — align with Phase 3 [full-phase plan](./struxient-v4-full-phase-implementation-plan.md).  
9. **`quoteNumber`:** Global per org vs per year sequence vs ULID display — branding and reporting impact.

---

## 17. Implementation sequence (for later coding)

After plan approval:

1. Schema design and migration (Quote, enums, children, indexes, FKs to Customer/Opportunity in-org).  
2. Quote server helpers: `requireQuoteAccess`, org scope assertions, role gates.  
3. `createQuoteDraftFromOpportunity` + opportunity/customer validation + events.  
4. Quote workspace data loader (single query or batched).  
5. Line item server actions + events.  
6. Quote task server actions + events.  
7. `evaluateQuoteSendReadiness` (+ optional draft readiness if distinct).  
8. `getQuoteCustomerPreview` projection + tests.  
9. **`/app/sales/quotes/[quoteId]`** route and UI sections (§6).  
10. Opportunity detail: create action, links, readiness integration.  
11. Activity event writer coverage audit.  
12. Automated tests (§12).  
13. Build / lint / full regression.

---

## Report (for reviewers)

1. **File created:** `docs/planning/phase-2-quote-workspace-mvp-plan.md`  
2. **Summary:** Phase 2 introduces **real Quote records** and the **Sales-owned quote workspace** at `/app/sales/quotes/[quoteId]`, with **line items**, **quote-prep vs planned execution tasks**, **server-derived readiness**, **internal customer preview**, **Ready to Send / Sent** transitions, and **quote activity events**, while **excluding** jobs, runtime tasks, portal, payments, catalog, FlowSpec, and scheduling.  
3. **Proposed models/enums:** `Quote` + `QuoteStatus`; `QuoteLineItem` + `PricingMode` + line modes; `QuoteTask` + `QuoteTaskKind` + `QuoteTaskStatus`; optional `QuoteAssumption`; `QuoteActivityEvent`; readiness as **computed** (optional non-authoritative cache only).  
4. **Proposed routes:** `/app/sales/quotes/[quoteId]` (primary); optional `/app/sales/quotes`; opportunity and customer surfaces link in; **no** `/scope` authority route.  
5. **Open decisions:** §16 (opportunity status enum timing, multi-quote, versioning/snapshot, assumptions shape, contact snapshot vs live, tax/margin/payment deferral, planned execution gate severity, sent-edit policy, quote numbering).  
6. **Risks:** §15 (scope split, runtime confusion, sent-edit leakage, preview leaks, pricing overbuild, client-only readiness, tenant bugs, bad opportunity states, multi-quote ambiguity).  
7. **Confirmation:** **No** code, schema, migrations, packages, or runtime behavior were changed by authoring this planning document.

---

*Planning document only.*
