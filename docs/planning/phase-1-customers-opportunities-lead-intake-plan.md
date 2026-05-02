# Phase 1 — Customers, Opportunities, Lead Intake (Implementation Plan)

## Purpose

This document is the **detailed implementation plan for Phase 1 only**: first **sales-side** objects and the **lead intake → opportunity** path, with **readiness toward quote draft** surfaced in the UI. It is intended for **review before any code is written**.

**Mode:** Planning only. **No** application code, **no** Prisma schema, **no** migrations, **no** new routes/components, **no** package installs, **no** runtime behavior changes are made by authoring this document.

**Global rule:** **Minimal is acceptable. Temporary is not.** No throwaway dev UX, fake business logic, or shortcuts that weaken **tenant isolation** or blur **sales vs sold** boundaries.

**Upstream plans:**

- [struxient-v4-full-phase-implementation-plan.md](./struxient-v4-full-phase-implementation-plan.md) — Phase 1 summary, ordering, handoff to Phase 2  
- [struxient-v4-clean-slate-implementation-blueprint.md](./struxient-v4-clean-slate-implementation-blueprint.md) — route blueprint, conceptual models, events MVP  

**Canon / architecture references:**

- [11-lead-intake-to-quote-creation](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md)  
- [06-sales-vs-sold-execution](../architecture/execution-workflow/06-sales-vs-sold-execution.md)  
- [app-shell README](../architecture/app-shell/README.md), [01-left-navigation-model](../architecture/app-shell/01-left-navigation-model.md), [05-surface-ownership-map](../architecture/app-shell/05-surface-ownership-map.md), [03-role-based-navigation-and-visibility](../architecture/app-shell/03-role-based-navigation-and-visibility.md), [04-login-auth-and-portal-model](../architecture/app-shell/04-login-auth-and-portal-model.md)  
- [struxient-v4-entity-map](../architecture/data-model/struxient-v4-entity-map.md)  
- [struxient-v4-permissions-matrix](../architecture/security/struxient-v4-permissions-matrix.md)  
- [struxient-v4-attachments-photos-evidence](../architecture/evidence/struxient-v4-attachments-photos-evidence.md) (attachment/evidence direction only)  
- [struxient-v4-requests-messages-notifications](../architecture/communication/struxient-v4-requests-messages-notifications.md) (context: Phase 1 does not build requests feed)

**Note on full-phase doc vs this plan:** The [full-phase plan](./struxient-v4-full-phase-implementation-plan.md) lists “create quote draft” inside Phase 1 acceptance. **This Phase 1 plan** defers **actual quote record creation and quote workspace** to **Phase 2**, per review scope: Phase 1 may ship a **deterministic readiness panel** and a **single handoff action** (server action stub or navigation placeholder) that **does not** implement quote authoring. Reconcile at kickoff if product wants quote row creation at end of Phase 1 (would still keep quote **UI** in Phase 2).

---

## 1. Phase 1 goal

Deliver the **first real sales-side objects** and **lead intake path** that canon describes:

- **Customer** records and **contact methods** (relationship anchor under **Customers**).  
- **Opportunity** records representing a **possible job**: linked customer, requested service, **scope intent**, intake-oriented fields, **source**, **status**, path toward **quote draft**.  
- **Lead / intake basics** captured on the opportunity (and optionally surfaced from customer where duplicated for convenience—**single source of truth** on customer vs opportunity is an open decision; see §16).  
- **Sales / pre-quote tasks** as **OpportunityTask** (or equivalent name)—**minimal checklist**, not a generic workflow engine.  
- **Opportunity activity / history** via append-only **OpportunityActivityEvent** (or shared “business event” table with discriminator—implementation decision later).  
- **Readiness toward quote draft**: **display-only**, **server-derived**, deterministic checklist (no quote line items, no quote workspace).  
- **Quote draft handoff**: **placeholder or Phase 2-owned** action only—e.g. disabled primary button with copy “Quote workspace (Phase 2)” **or** a server action that returns “not implemented” until Phase 2 **only if** the team explicitly wants a stub API surface early (**prefer** UI handoff without fake persistence).

**Canon alignment (must hold after implementation):**

- Lead intake **creates or updates an Opportunity** ([11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md)).  
- Opportunity = possible job + customer + requested service/scope + intake facts + readiness toward quote creation.  
- **Sales / pre-quote** work is **separate** from **sold execution** ([06](../architecture/execution-workflow/06-sales-vs-sold-execution.md)); **OpportunityTask** must **not** become **RuntimeTask** or job board tasks.  
- Useful **outputs** from intake (notes, address, scope intent) are **durable fields** intended to **carry forward** into Phase 2 quote context—**not** simulated.  
- **Work Station** may later surface sales tasks; Phase 1 **does not** build the real Work Station feed ([full-phase plan](./struxient-v4-full-phase-implementation-plan.md) Phase 5).

---

## 2. Source canon references

| Topic | Document |
|-------|----------|
| Lead → opportunity → quote-creation readiness | [11-lead-intake-to-quote-creation](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md) |
| Sales lane vs sold execution; quote as bridge | [06-sales-vs-sold-execution](../architecture/execution-workflow/06-sales-vs-sold-execution.md) |
| Customers vs Sales ownership | [01-left-navigation-model](../architecture/app-shell/01-left-navigation-model.md), [05-surface-ownership-map](../architecture/app-shell/05-surface-ownership-map.md) |
| Role/nav visibility (not security) | [03-role-based-navigation-and-visibility](../architecture/app-shell/03-role-based-navigation-and-visibility.md) |
| Tenant, portal boundary, session chain | [04-login-auth-and-portal-model](../architecture/app-shell/04-login-auth-and-portal-model.md) |
| Customer → opportunity → quote spine | [struxient-v4-entity-map](../architecture/data-model/struxient-v4-entity-map.md) |
| Server-side permission defaults | [struxient-v4-permissions-matrix](../architecture/security/struxient-v4-permissions-matrix.md) |
| Attachments carry-forward concept | [struxient-v4-attachments-photos-evidence](../architecture/evidence/struxient-v4-attachments-photos-evidence.md) |

---

## 3. Current Phase 0 foundation assumptions

**Verified in workspace at planning time** (re-audit before coding):

| Assumption | Status |
|------------|--------|
| **Auth exists** | **Yes** — `src/app/api/auth/[...nextauth]/route.ts`, `(auth)/login` present. |
| **Tenant / org / membership exists** | **Assume yes** for Phase 0 completion — confirm schema and session claims match this plan’s “derive org from server session” rule before Phase 1 mutations. |
| **Protected `/app` shell** | **Yes** — `(app)/app` layout and routes exist. |
| **Left nav exists** | **Assume yes** per Phase 0 plan; confirm nav component wires to canonical items. |
| **Work Station / Admin / Settings placeholders** | **Yes** — `src/app/(app)/app/work-station`, `admin`, `settings` pages exist. |
| **No Customers / Sales / Quotes routes yet** | **Verified** — no `customers` or `sales` segments under `src/app/(app)/app/` in current tree; quotes not present. |

If any assumption fails at kickoff, **complete Phase 0 gaps first** (per [full-phase implementation rule](./struxient-v4-full-phase-implementation-plan.md)).

---

## 4. Phase 1 route plan

Routes follow **internal `/app/*`** boundary ([clean-slate blueprint](./struxient-v4-clean-slate-implementation-blueprint.md), [app-shell 04](../architecture/app-shell/04-login-auth-and-portal-model.md)). Exact segment strings may be adjusted in implementation if IA review requires it, but **ownership** must match canon: **Customers** = relationship record; **Sales** = pre-send pipeline including opportunities.

| Route | Purpose |
|-------|---------|
| `/app/customers` | Customer list (org-scoped). |
| `/app/customers/new` | Create customer (form). |
| `/app/customers/[customerId]` | Customer profile: summary, contact methods, linked opportunities (list + deep links to Sales). |
| `/app/sales` | Sales hub: **redirect** to `/app/sales/opportunities` or compact landing with counts + primary CTA “New opportunity” (implementation choice—avoid empty vanity page). |
| `/app/sales/opportunities` | Opportunity list (filters: status, owner optional). |
| `/app/sales/opportunities/new` | Create opportunity (customer picker or preselected `?customerId=`). |
| `/app/sales/opportunities/[opportunityId]` | **Opportunity detail / intake workspace** (primary Phase 1 surface). |

**Canon clarifications:**

- **Customers** owns the **relationship** record and **contact methods** ([01](../architecture/app-shell/01-left-navigation-model.md)).  
- **Sales** owns **opportunity** and future **quote** surfaces ([01](../architecture/app-shell/01-left-navigation-model.md)); opportunity **belongs to** a customer.  
- **No** `/app/sales/quotes/*` **workspace** in Phase 1 ([full-phase plan](./struxient-v4-full-phase-implementation-plan.md) Phase 2).

---

## 5. Phase 1 data model planning

All names are **conceptual** until schema review. Every business row includes **`organizationId`** (or equivalent) for **tenant isolation**.

### Customer

| | |
|--|--|
| **Purpose** | CRM anchor: who the company is talking to; long-lived relationship record ([entity map](../architecture/data-model/struxient-v4-entity-map.md)). |
| **Key fields** | `organizationId`; **display name** (person or company label); optional **kind** (`PERSON` / `COMPANY` / `UNKNOWN`) if product needs distinct UX; **notes** or short **summary**; optional **status** (`ACTIVE` / `INACTIVE` / `ARCHIVED`) if needed for list hygiene; `createdAt`, `updatedAt`. |
| **Relationships** | 1→N `CustomerContactMethod`; 1→N `Opportunity`. |
| **MVP needed?** | **Yes.** |
| **Later expansion** | Billing address vs service address split; tags; duplicate merge; comms integration IDs; portal identity link (Phase 7). |

### CustomerContactMethod

| | |
|--|--|
| **Purpose** | Reachability and consent hints for the customer ([11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md) customer data examples). |
| **Key fields** | `customerId`; **type**: `EMAIL` / `PHONE` / `MOBILE` / `OTHER`; **value**; **isPrimary**; **okToEmail** / **okToSms** (booleans, default false until explicitly set); **label** (e.g. “Cell”, “Billing”); optional **active** / **archived** flag or soft-archive timestamp. |
| **Relationships** | N→1 `Customer` (same org). |
| **MVP needed?** | **Yes** (at least one method is typical; readiness may allow “TBD” path—see §8). |
| **Later expansion** | Verified timestamps; SMS provider IDs; portal invitation email selection. |

### Opportunity

| | |
|--|--|
| **Purpose** | Possible job: pre-send pipeline object ([11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md), [entity map](../architecture/data-model/struxient-v4-entity-map.md)). |
| **Key fields** | `organizationId`; `customerId`; **title**; **serviceType** (string or FK later—string MVP acceptable if validated); **source** / lead source (string or enum); **status** (see §6); **priority** (enum or ordered int); **job / service address**: either structured (`line1`, `city`, `state`, `postal`, `country`) **or** single **address text** MVP with explicit **`serviceAddressTbd`** boolean—**must** support “TBD” without fake placeholder text as “real” address; **scopeIntent** (text, prominent); **desiredTimeline** (text or date range—keep simple); **salesOwnerUserId** nullable (membership user); **qualificationStatus** (simple enum or text); **estimatedValue** optional (decimal); **lostReason** / **noQuoteReason** optional text; **followUpAt** optional datetime; `createdAt`, `updatedAt`. |
| **Relationships** | N→1 `Customer`; 1→N `OpportunityTask`; 1→N `OpportunityActivityEvent`; future 1→N `Quote` (Phase 2). |
| **MVP needed?** | **Yes.** |
| **Later expansion** | `OpportunityWorkflowInstance` / template-driven stages ([11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md)); structured intake facts; catalog/template suggestions; explicit link to future `Quote.id`. |

### OpportunityTask (Lead intake / sales checklist)

| | |
|--|--|
| **Purpose** | Materialize intake as **actionable checklist items** on the opportunity—not a full workflow engine ([11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md) §“Intake Tasks and Outcomes”). |
| **Key fields** | `opportunityId`; **title**; **status** (see §6 task statuses); **kind** (enum: e.g. `INTAKE`, `SITE_VISIT`, `REVIEW`, `OTHER`)—**must not** reuse `RuntimeTask` or quote `QUOTE_PREP` / `PLANNED_EXECUTION` enums; **dueAt** optional; **assigneeUserId** optional; **source** (`MANUAL` / `TEMPLATE` / `SYSTEM` for future); **outcome** optional short text when completed. |
| **Relationships** | N→1 `Opportunity` (org via opportunity or denormalized `organizationId` for query performance—implementation decision). |
| **MVP needed?** | **Yes** (minimal: user-added tasks + complete toggle; optional seed tasks on create—**only** if deterministic and documented, not random demo data). |
| **Later expansion** | Typed outcomes spawning tasks ([11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md)); dependencies; Work Station card linkage (Phase 5). |

### OpportunityActivityEvent

| | |
|--|--|
| **Purpose** | Append-only **history** for “what changed and why” on the sales object ([05](../architecture/execution-workflow/05-deterministic-execution-engine.md) spirit); feeds opportunity detail **Activity** tab and future Work Station explanations. |
| **Key fields** | `organizationId`; `opportunityId`; optional `customerId` (denormalized for customer-timeline queries); **eventType** (string enum from §11); **actorUserId` nullable for system actions; **payload** JSON or **summary** text (human-readable line + structured blob); **createdAt**. |
| **Relationships** | N→1 `Opportunity`; optional link to `Customer` for future “customer timeline” aggregation. |
| **MVP needed?** | **Yes** for mutations listed in §9. |
| **Later expansion** | Correlation ids; portal-originated events (Phase 7); integration webhooks. |

### Attachment (Phase 1 scope)

| | |
|--|--|
| **Purpose** | Files linked to customer/opportunity for context ([evidence doc](../architecture/evidence/struxient-v4-attachments-photos-evidence.md)). |
| **Phase 1 recommendation** | **Defer uploads.** Plan **one** polymorphic or keyed association pattern in schema review (e.g. `parentType` + `parentId`) **without** building storage, signed URLs, or virus scan. Optional: **no attachment table** in Phase 1 if it risks overbuild—then intake photos wait for Phase 2 quote context + Phase 13 evidence depth. |
| **Minimal planning only** | If a table is introduced, MVP = metadata + storage key + `organizationId` + visibility enum; **no** customer portal exposure in Phase 1. |

---

## 6. Status / state planning

### Opportunity statuses

Use a **single ordered enum** (or explicit state machine table later) with **deterministic** transitions documented in code comments / small matrix during implementation.

Planned values:

1. **New**  
2. **Qualified**  
3. **Info Gathering**  
4. **Site Visit Needed**  
5. **Quote Draft Ready**  
6. **Quote Draft Created** (set when a real quote record exists—**Phase 2** if quote row deferred)  
7. **Quote Sent** (later—Phase 2/3; may remain unused in Phase 1)  
8. **Won** (later)  
9. **Lost**  
10. **No Quote**  
11. **Archived**

**Rules (planning):**

- **Lost** and **No Quote** require **reason** capture (field already on model plan).  
- **Archived** is terminal for housekeeping; clarify whether **Archived** supersedes Lost/No Quote or is orthogonal (**open decision**).  
- Avoid “hidden” states—every list filter should map to these values.

### Opportunity task statuses

Keep **simple and deterministic**:

- **Not Ready**  
- **Ready**  
- **In Progress**  
- **Waiting**  
- **Blocked**  
- **Needs Review**  
- **Complete**  
- **Canceled**

**Note:** Blueprint state machine used `Skipped` for quote tasks; Phase 1 opportunity tasks may use **Canceled** instead for clarity—align naming at schema review.

---

## 7. Lead intake UX plan

**Visual system:** Same Struxient v4 standard as Phase 0 (§12): dark-only, shadcn/ui, Tailwind, lucide-react, black background, blue accent, sharp radius, dense professional contractor ops aesthetic—**no** default starter marketing look, **no** “coming soon” filler; empty states = **action-oriented** (primary CTA + short guidance).

### Surfaces

1. **Customer list** — sortable table or dense list; row → detail; **New customer** CTA.  
2. **Customer detail** — header (name, status); **contact methods** block with add/edit/set primary; **notes**; **Opportunities** list with link to `/app/sales/opportunities/[id]`; no fake quote/job rows—show empty sections with explain + link to Sales.  
3. **Create customer form** — required display name; optional kind; notes; after save → detail or “add contact method” prompt.  
4. **Opportunity list** — columns: title, customer, status, owner, updated; filters; **New opportunity** CTA.  
5. **Create opportunity form** — customer select (search); title; service type; source; scope intent; address block + **“Service address TBD”** explicit control; priority; optional owner self-assign.  
6. **Opportunity detail / intake workspace** — single scrollable workspace with sections:  
   - **Customer summary** (read-only strip + link to customer).  
   - **Service / request** — service type, source, priority, qualification.  
   - **Scope intent** — prominent text area.  
   - **Intake facts** — address/timeline/estimated value/follow-up.  
   - **Tasks / checklist** — add task, status controls, assignee if used.  
   - **Readiness toward quote draft** — panel from §8 (server-driven).  
   - **Activity / history** — chronological events from §11.  
   - **Next recommended action** — **one** primary CTA area: either **Open customer** / **Add contact** / **Complete blocking intake task** based on readiness, plus **Quote workspace (Phase 2)** handoff when readiness satisfied **or** always show handoff as secondary until Phase 2 exists (UX decision at build).

**Explicit non-goals for UX:** toy gradients, lorem ipsum, seeded fake customers in production paths, heavy “dev only” panels on customer-facing routes.

---

## 8. Basic readiness for quote draft

Phase 1 **displays** readiness only; **no** quote creation logic unless explicitly pulled forward from Phase 2.

Each readiness item is computed **on the server** (same inputs → same outputs) and returned as:

| Property | Description |
|----------|-------------|
| **key** | Stable machine key (e.g. `customer_exists`). |
| **label** | Short UI label. |
| **status** | `PASS` / `FAIL` / `WAIVED` / `NOT_APPLICABLE` as needed—keep small. |
| **severity** | `BLOCKER` / `WARNING` / `INFO` for display; blockers prevent **canonical** “ready to create quote” messaging. |
| **fixLocation** | Route or section key (e.g. `customers/[id]/contacts`, `opportunity/scope`). |
| **explanation** | Human string explaining what is missing. |

### Example checks (MVP set)

| key | rule (deterministic) |
|-----|----------------------|
| `customer_linked` | Opportunity has valid `customerId` in org. |
| `contact_or_waived` | At least one **active** contact method on customer **or** `contactIntakeWaived` flag on opportunity/customer (**open decision**: where to store waiver; must be explicit user action, not default). |
| `service_type` | `serviceType` non-empty trimmed. |
| `scope_intent` | `scopeIntent` non-empty trimmed. |
| `service_address_or_tbd` | Structured address complete **or** `serviceAddressTbd === true`. |
| `required_intake_tasks` | If **required** tasks exist (future template), all complete; Phase 1: define as **optional**—if no “required” concept yet, omit or always `NOT_APPLICABLE`. |

**Waivers:** Any “waived” path must be **auditable** (activity event) when implemented.

---

## 9. Server actions / APIs plan

All actions:

- Require **authenticated** user.  
- Resolve **`organizationId` from server session + membership**—**never** trust client-supplied org.  
- Enforce **role** per §10.  
- **Validate input server-side** (zod or equivalent at implementation).  
- Write **`OpportunityActivityEvent`** (and customer-level events where noted) on successful mutations.

| Action | Purpose | Activity notes |
|--------|---------|----------------|
| `createCustomer` | Insert customer | `CUSTOMER_CREATED` |
| `updateCustomer` | Update fields | `CUSTOMER_UPDATED` |
| `archiveCustomer` (optional) | Soft-archive | event type TBD / `CUSTOMER_UPDATED` with payload |
| `addCustomerContactMethod` | Add contact | `CUSTOMER_CONTACT_ADDED` |
| `updateCustomerContactMethod` | Edit/archive contact | `CUSTOMER_UPDATED` or dedicated contact event |
| `createOpportunity` | Create opp for customer | `OPPORTUNITY_CREATED` |
| `updateOpportunity` | Patch fields/status | `OPPORTUNITY_UPDATED` |
| `addOpportunityTask` | Add checklist item | `OPPORTUNITY_TASK_ADDED` |
| `updateOpportunityTaskStatus` / `completeOpportunityTask` | Task lifecycle | `OPPORTUNITY_TASK_COMPLETED` when entering Complete |
| `recordOpportunityActivity` | Manual note/call log (optional) | Custom type e.g. `NOTE_ADDED` or generic `OPPORTUNITY_UPDATED` |
| `markOpportunityLost` | Terminal lost | `OPPORTUNITY_MARKED_LOST` |
| `markOpportunityNoQuote` | Terminal no-quote | `OPPORTUNITY_MARKED_NO_QUOTE` |
| `prepareCreateQuoteDraft` / `requestQuoteDraft` | **Placeholder** for Phase 2: either **no-op** returning `{ phase: 2 }` or creates quote row—**decide at kickoff** (see §16) | `QUOTE_DRAFT_REQUESTED` **only** when action is real |

**Reads:** list/get customer, list/get opportunity—all queries **`where organizationId = sessionOrg`**.

---

## 10. Permission / security plan

- **Server-side tenant scoping** on every query and mutation (`organizationId` from membership).  
- **No client-provided org authority** — reject any API that accepts `organizationId` from the browser for authorization purposes.  
- **Customer and opportunity reads** filter by org; **by-id** fetches must **404 or 403** if id not in org (avoid id enumeration).  
- **Route protection:** `/app/customers/**` and `/app/sales/**` under same protected layout as Phase 0.  
- **Roles (conceptual, per permissions matrix):**  
  - **Owner / Admin / Manager / Office / Sales:** create/read/update opportunities and customers per matrix defaults ([struxient-v4-permissions-matrix](../architecture/security/struxient-v4-permissions-matrix.md)).  
  - **Crew Lead / Field:** **limited or no access** to Sales in Phase 1—match [03](../architecture/app-shell/03-role-based-navigation-and-visibility.md) (Sales **Hidden** for Field); enforce on server even if nav hides links.  
- **Customer portal:** not in Phase 1; no exposure of internal notes to external actors.  
- **Internal notes:** if stored on customer/opportunity, still **server-only** enforcement for any future portal; Phase 1 internal routes only.

---

## 11. Events / history plan

Suggested **`OpportunityActivityEvent.eventType`** values (extend in one enum file at implementation):

| Event type | When |
|------------|------|
| `CUSTOMER_CREATED` | Customer created |
| `CUSTOMER_UPDATED` | Customer profile updated |
| `CUSTOMER_CONTACT_ADDED` | New contact method |
| `OPPORTUNITY_CREATED` | Opportunity created |
| `OPPORTUNITY_UPDATED` | Field/status change (may coalesce in UI if noisy—implementation detail) |
| `OPPORTUNITY_TASK_ADDED` | Task added |
| `OPPORTUNITY_TASK_COMPLETED` | Task marked complete |
| `OPPORTUNITY_MARKED_LOST` | Terminal lost |
| `OPPORTUNITY_MARKED_NO_QUOTE` | Terminal no-quote |
| `QUOTE_DRAFT_REQUESTED` | User invoked handoff action (Phase 1 placeholder or Phase 2 real create) |

**Customer-scoped events:** `CUSTOMER_*` may live on customer timeline table or duplicate summary on opportunity—**prefer single table** with optional `customerId` for simpler queries.

**Future Work Station:** event types and payloads should include enough **summary** for card explanations without joining heavy tables ([09](../architecture/execution-workflow/09-work-station-what-now.md) patterns, Phase 5).

---

## 12. UI / UX requirements

- **Dark mode only** — no theme toggle unless already committed in Phase 0.  
- **shadcn/ui** + **Tailwind** + **lucide-react**.  
- **Black background**, **blue accent**, **sharp / tight radius**, professional contractor/business ops density.  
- **No** default Vercel/marketing starter framing on app routes.  
- **No** “coming soon” junk—use **useful empty states** (CTA + one sentence of what to do).  
- Forms: inline validation, server error toasts/banners, loading states on mutations.

---

## 13. Acceptance criteria

- [ ] Authenticated user with allowed role can open **Customers** and **Sales** routes.  
- [ ] Unauthenticated user **cannot** access those routes (redirect to login).  
- [ ] User can **create customer** and reopen from list.  
- [ ] User can **add** (and edit) **contact method**.  
- [ ] User can **create opportunity** for a customer and open detail.  
- [ ] Opportunity detail shows **intake facts**, **scope intent**, **tasks**, and **activity/history**.  
- [ ] **Readiness toward quote draft** visible, deterministic, server-derived.  
- [ ] **Tenant scoping** enforced on all reads/writes (manual + automated where harness exists).  
- [ ] **Activity events** recorded for create/update/task complete and terminal states.  
- [ ] Nav items **Customers** and **Sales** appear **active** (enabled + linked) **only** when implemented—no dead links that 404 silently.  
- [ ] **No quote workspace** in Phase 1 beyond allowed **handoff placeholder** (no line items, no send).  
- [ ] **Build / lint** pass on CI/local standards.

---

## 14. Explicitly out of scope

- Quote workspace implementation (`/app/sales/quotes/[quoteId]`).  
- Quote line items, pricing engine, customer preview.  
- Quote send / acceptance / revision (Phases 2–3).  
- Job activation, **RuntimeTask**, job workflow (Phase 4).  
- Customer portal (Phase 7).  
- Full attachment / evidence upload system (Phase 13 depth); optional minimal table only per §5.  
- Full **Work Station** feed (Phase 5).  
- Scheduling / calendar (Phase 6).  
- Finance / payment gates (Phase 11).  
- Catalog / packets (Phase 8).  
- FlowSpec builder (Phase 9).  
- AI intake.  
- Full comms / requests queue ([communication](../architecture/communication/struxient-v4-requests-messages-notifications.md) Phase 14).

---

## 15. Risks and drift warnings

| Risk | Warning / mitigation |
|------|----------------------|
| **Generic CRM** | Avoid feature sprawl (pipelines, arbitrary custom fields) before quote/job proof—stay close to contractor intake ([11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md)). |
| **Quote features too early** | No line items or second “scope app”; quote workspace stays Phase 2 ([12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)). |
| **Opportunity tasks → job tasks** | Separate **table/type** from `RuntimeTask`; code review checklist before Phase 4. |
| **Weak tenant scoping** | Integration tests with two orgs; never accept org id from client. |
| **Overbuilding uploads/evidence** | Defer to Phase 2/13 unless minimal metadata is truly free ([evidence](../architecture/evidence/struxient-v4-attachments-photos-evidence.md)). |
| **Duplicate customer/contact truth** | Decide whether phone/email on opportunity is **copy** or **display-only** from customer—avoid conflicting edits ([handoff rules in 11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md)). |
| **Business logic only in client** | Readiness + permissions + transitions validated **server-side** ([security](../architecture/security/struxient-v4-permissions-matrix.md)). |

---

## 16. Implementation sequence (for later coding)

Order for the engineering pass after plan approval:

1. **Schema design review** (Prisma or equivalent) — models §5, indexes on `(organizationId, ...)`, FK cascades documented.  
2. **Migrations** (implementation step—not in this doc).  
3. **Server helpers** — `requireSession`, `requireOrgMembership`, `assertOrgRecord` patterns centralized.  
4. **Customer mutations + reads** — actions + minimal list/detail data loaders.  
5. **Opportunity mutations + reads** — actions + detail loader including tasks + events.  
6. **Routes / pages** — §4 route tree + layouts.  
7. **Forms** — customer, contact, opportunity create/edit.  
8. **Activity events** — writer helper; ensure transactional consistency with mutations.  
9. **Readiness** — pure server function returning DTO; wire panel on opportunity detail.  
10. **Nav** — enable Customers + Sales with correct `href`s and role-based visibility ([03](../architecture/app-shell/03-role-based-navigation-and-visibility.md)).  
11. **Quote handoff placeholder** — UI + optional stub action per kickoff decision.  
12. **Build / lint / test** — unit tests for readiness + scoping if feasible; manual test script from §17.

---

## 17. Testing and verification plan

| Test | Expected |
|------|----------|
| Create customer | Row in org; `CUSTOMER_CREATED` event. |
| Add / update contact | Visible on profile; event. |
| Create opportunity | Linked to customer; `OPPORTUNITY_CREATED`; appears on lists. |
| Update opportunity fields | Persistence + `OPPORTUNITY_UPDATED`. |
| Complete intake task | Status **Complete**; `OPPORTUNITY_TASK_COMPLETED`. |
| Activity history | Ordered timeline matches mutations. |
| Tenant scoping | User in org A cannot fetch org B ids (403/404). |
| Unauthenticated | `/app/customers` and `/app/sales/*` redirect to login. |
| Cross-org seed (if available) | Confirms isolation with second org fixture. |
| Build / lint | CI green. |

---

## Report (for reviewers)

1. **File created:** `docs/planning/phase-1-customers-opportunities-lead-intake-plan.md`  
2. **Summary:** Phase 1 adds **org-scoped customers**, **contact methods**, **opportunities** with intake fields, **opportunity tasks**, **activity events**, and a **server-driven readiness panel** toward quote draft—without quote workspace, uploads, Work Station feed, or runtime job tasks. Quote creation may be **Phase 2-owned** with an explicit handoff placeholder.  
3. **Proposed models:** `Customer`, `CustomerContactMethod`, `Opportunity`, `OpportunityTask`, `OpportunityActivityEvent`; **Attachment** deferred or minimal metadata only.  
4. **Proposed routes:** `/app/customers`, `/app/customers/new`, `/app/customers/[customerId]`, `/app/sales`, `/app/sales/opportunities`, `/app/sales/opportunities/new`, `/app/sales/opportunities/[opportunityId]`.  
5. **Open decisions:** (a) Quote draft **row** at end of Phase 1 vs strict Phase 2 ownership; (b) **Archived** vs **Lost/No Quote** semantics; (c) **Contact waiver** storage location; (d) **Required intake tasks** in Phase 1 or defer; (e) duplicate **address/phone on opportunity** vs customer-only source of truth.  
6. **Risks:** CRM overbuild; quote scope creep; task model confusion with runtime; weak multi-tenant checks; client-only readiness; attachment overbuild.  
7. **Confirmation:** **No** code, schema, migrations, packages, or runtime behavior were changed by authoring this planning document.

---

*Planning document only.*
