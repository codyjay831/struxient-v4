# Struxient v4 Clean-Slate Implementation Blueprint

## Purpose

This document is the **first-build blueprint** for a **brand-new** Struxient v4 application. **Documentation is the source of truth**—not non-existent or immature app code.

It answers:

- **What** do we build first?  
- **What** do we intentionally **not** build first?  
- What is the **first vertical slice**?  
- What **routes/screens** should exist (conceptually)?  
- What **conceptual data models** are needed first?  
- What **APIs/server actions** will likely be needed first?  
- What **user flows** should we prove first?  
- How do we **avoid** overbuilding FlowSpec, scheduling, customer portal, and advanced outcomes too early?  
- How do we **preserve canon** while shipping a **small MVP**?

**Scope:** Planning only. **No** implementation code, **no** Prisma schema, **no** migrations, **no** routes/components in this pass.

**Relationship to other docs:** This blueprint **operationalizes** [struxient-v4-mvp-scope-and-build-order.md](./struxient-v4-mvp-scope-and-build-order.md) and the canon under `docs/architecture/execution-workflow/`, `docs/architecture/app-shell/`, and the topic folders (`data-model`, `work-station`, `catalog`, `flowspec`, `customer-portal`, `finance`, `change-orders`, `evidence`, `security`, `communication`). **Do not** use a canon-to-code audit as input—there is no meaningful existing app to audit yet.

---

## Clean-slate direction

**Prefer**

- Clean **data model** and **route** structure aligned with long-term canon.  
- **One** first **vertical slice** that proves customer → opportunity → quote → readiness → preview → sent.  
- **Permanent**, production-safe **foundation**: auth, **tenant/org**, baseline **RBAC**, **event/activity** spine.  
- **Deterministic** readiness and status transitions ([execution-workflow 05](../architecture/execution-workflow/05-deterministic-execution-engine.md)).  
- **Progressive UI**: simple default, expandable advanced ([execution-workflow 01](../architecture/execution-workflow/01-canon-summary.md), [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)).  
- **No temporary hacks** that contradict “quote workspace is primary authority” or “planned execution is dormant on quote until activation.”

**Avoid**

- Shipping the **entire** canon at once.  
- A **generic task app** without quote/job context ([03](../architecture/execution-workflow/03-quote-to-execution-model.md)).  
- A **workflow/FlowSpec builder** before quote + execution path is proven ([flowspec](../architecture/flowspec/struxient-v4-flowspec-builder.md) deferred).  
- **Price-only** quote page or a **separate scope page** as competing truth ([12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)).  
- **AI** scheduling or automation before **deterministic** readiness and events exist.  
- **Full customer portal** before quote/send **foundation** ([customer-portal](../architecture/customer-portal/struxient-v4-customer-portal-mvp.md) Phase 7).  
- **Full calendar** before **task readiness** and schedule **facts** exist ([13](../architecture/execution-workflow/13-calendar-and-scheduling-model.md)).

---

## First vertical slice (definition)

**Story:** Internal staff **logs in** → lands in **app shell** / **Work Station placeholder** → **creates or opens a Customer** → **creates an Opportunity** → **creates a Quote draft** → **adds line items** → **adds basic planned execution tasks** (under line items or quote) → **readiness checklist** shows missing/complete → **customer preview** can be viewed → quote can be **marked Sent** → **status/history** updates.

**This slice proves**

| Proof | Canon reference |
|-------|-----------------|
| Tenant-aware **app shell** + core **nav** | [app-shell](../architecture/app-shell/README.md) |
| **Customer → Opportunity → Quote** relationships | [02](../architecture/execution-workflow/02-lifecycle-model.md), [11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md), [entity map](../architecture/data-model/struxient-v4-entity-map.md) |
| **Quote workspace** as **primary authority** for commercial + operational plan | [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md), [03](../architecture/execution-workflow/03-quote-to-execution-model.md) |
| **Line items** = commercial scope | [03](../architecture/execution-workflow/03-quote-to-execution-model.md) |
| **Planned execution** on quote = **dormant** plan | [06](../architecture/execution-workflow/06-sales-vs-sold-execution.md) |
| **Readiness** blockers (deterministic) | [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md) |
| **Activity/event** baseline | [05](../architecture/execution-workflow/05-deterministic-execution-engine.md), [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md) §9 |
| **Work Station** can later **surface** quote tasks/blockers without redesigning quote | [work-station MVP](../architecture/work-station/struxient-v4-work-station-mvp.md), [09](../architecture/execution-workflow/09-work-station-what-now.md) |

**Explicitly not required in slice 1:** job activation, runtime tasks, customer portal, calendar, FlowSpec builder, payment gates, change orders.

---

## Recommended build phases

Phase intent matches [MVP scope](./struxient-v4-mvp-scope-and-build-order.md) but is **sequenced for clean-slate engineering** with named deliverables.

### Phase 0: Foundation

- **App framework** (e.g., Next.js App Router) if starting from empty repo.  
- **Auth** (session/JWT pattern TBD) + **tenant/organization** on every request.  
- **User**, **membership**, **role/permission** baseline ([security](../architecture/security/struxient-v4-permissions-matrix.md), [app-shell 04](../architecture/app-shell/04-login-auth-and-portal-model.md)).  
- **App shell**: layout, **left nav** skeleton ([app-shell 01](../architecture/app-shell/01-left-navigation-model.md)), **dark UI** baseline.  
- **Database** connection; **no** final schema in this doc—only “tables/collections will exist.”  
- **Audit/event** storage baseline: append or insert **QuoteActivityEvent** / **WorkflowEvent**-style rows ([05](../architecture/execution-workflow/05-deterministic-execution-engine.md)).

### Phase 1: Customer + Opportunity

- **Customer** record; **contact methods**.  
- **Opportunity** linked to customer; minimal **status** (state machine below).  
- **Lead/intake** basics: key fields or minimal **OpportunityTask** for sales/pre-quote ([11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md))—keep **minimal**; do not build full opportunity workflow engine.

### Phase 2: Quote workspace MVP

- **Quote** draft; **header/status**; **line items**; **pricing** + **assumptions**.  
- **Quote-prep tasks** vs **planned execution tasks** distinguished in **model and UI labels** ([12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)).  
- **Readiness checklist** (MVP rules below).  
- **Activity history** from events.  
- **Customer preview** (internal route or modal—**customer-safe projection** only, [08](../architecture/execution-workflow/08-customer-view.md)).

### Phase 3: Send / acceptance placeholder

- **Mark quote Sent**; optional **send payload** stub (email/integration later).  
- **Quote revision** basics (new version or revision flag—conceptual only until schema).  
- **Manual** Signed/Accepted (button or status) to unlock Phase 4 without full e-sign product.

### Phase 4: Job activation MVP

- **Create Job** from accepted quote.  
- **Copy** planned execution → **runtime tasks**; **minimal JobWorkflowInstance** ([06](../architecture/execution-workflow/06-sales-vs-sold-execution.md), [entity map](../architecture/data-model/struxient-v4-entity-map.md)).  
- **Task completion**; **basic WorkflowEvent** / job activity.  
- **Invariant:** No **sales-only** tasks become **runtime** job tasks.

### Phase 5: Work Station MVP

- Aggregate **quote + job** tasks into feeds: **Now**, **Blocked**, **Waiting**, **Needs Review** ([work-station MVP](../architecture/work-station/struxient-v4-work-station-mvp.md)).  
- **Deterministic** short explanations for blockers.  
- **Deep links** into `/app/sales/quotes/[quoteId]` and `/app/jobs/[jobId]`.

### Phase 6: Scheduling MVP

- **Estimated duration** + **scheduled start/end** on tasks ([07](../architecture/execution-workflow/07-task-dimensions.md), [13](../architecture/execution-workflow/13-calendar-and-scheduling-model.md)).  
- **Customer availability** windows.  
- **Crew assignment** minimal.  
- **Schedule readiness** labels (scheduled / at risk / blocked)—facts-driven.

### Phase 7: Customer portal MVP

- **Secure token** route; proposal view; upload request; availability confirm; milestones ([customer-portal](../architecture/customer-portal/struxient-v4-customer-portal-mvp.md)).

### Phase 8: Advanced canon (later)

- **FlowSpec Builder**, **Catalog** packets/templates, **outcome rules**, **change orders**, **finance/payment gates**, **evidence/closeout**, **requests/messages/notifications** per respective architecture docs—**after** Phases 0–7 are stable.

---

## Route blueprint (conceptual)

**Not final URLs**—structure should mirror [app-shell](../architecture/app-shell/README.md) canon.

### Internal (staff)

| Route (example) | Purpose |
|-----------------|--------|
| `/login` | Staff auth |
| `/app` | Redirect to default home (e.g. Work Station) |
| `/app/work-station` | Command center (placeholder until Phase 5) |
| `/app/customers` | List |
| `/app/customers/[customerId]` | Profile + linked opportunities/quotes/jobs |
| `/app/sales` | Sales hub |
| `/app/sales/opportunities` | List |
| `/app/sales/opportunities/[opportunityId]` | Opportunity + path to quote |
| `/app/sales/quotes/[quoteId]` | **Quote workspace** (primary authority) |
| `/app/jobs` | List (Phase 4+) |
| `/app/jobs/[jobId]` | Job detail + runtime tasks |
| `/app/catalog` | Stub or hidden until Phase 8 |
| `/app/flowspec` | Stub or hidden until Phase 8 |
| `/app/finance` | Stub until Phase 8 |
| `/app/admin` | Users/org settings minimal |
| `/app/settings` | User prefs |

### Customer portal (Phase 7+)

| Route (example) | Purpose |
|-----------------|--------|
| `/portal/[token]` | Scoped portal home |
| `/portal/[token]/quote` | Proposal view |
| `/portal/[token]/uploads` | Upload requests |
| `/portal/[token]/schedule` | Availability / appointments |

**Principle:** Internal app under `/app/*`; portal isolated under `/portal/*` for **clear security boundary** ([app-shell 04](../architecture/app-shell/04-login-auth-and-portal-model.md)).

---

## Conceptual data model (MVP-first)

**No Prisma.** Each row: purpose, key conceptual fields, relationships, **MVP?**, later expansion.

| Entity | Purpose | Key fields (conceptual) | Relationships | MVP? |
|--------|---------|---------------------------|---------------|------|
| **Tenant / Organization** | Multi-tenant boundary | name, slug | users, all records | **Yes** (Phase 0) |
| **User** | Login identity | email, name | memberships | **Yes** |
| **Membership** | User in org | role keys | user, tenant | **Yes** |
| **Role / Permission** | RBAC | role id, permission keys | membership | **Yes** (minimal) |
| **Customer** | CRM anchor | name, notes | opportunities, quotes, jobs | **Yes** (Phase 1) |
| **CustomerContactMethod** | Email/phone/etc. | type, value, primary | customer | **Yes** |
| **Opportunity** | Possible job | status, title, service type | customer, quotes | **Yes** |
| **OpportunityTask** | Sales/pre-quote task | status, title | opportunity | **Partial** (minimal Phase 1) |
| **Quote** | Commercial + operational plan | status, totals, currency | opportunity, customer | **Yes** (Phase 2) |
| **QuoteVersion** / snapshot | Revision history | version number, frozen payload ref | quote | **Later** (Phase 3+); MVP can use single quote row + events first |
| **QuoteLineItem** | Commercial scope | title, description, qty, price, flags | quote | **Yes** |
| **QuoteTask** (split conceptually) | **Quote-prep** vs **PlannedTask** | `kind`, status, title, lineItemId? | quote | **Yes**—use `kind` enum: `QUOTE_PREP` / `PLANNED_EXECUTION` |
| **QuoteReadinessCheck** | Derived row or materialized | key, pass/fail, severity | quote | **Yes** (can be computed + cached) |
| **QuoteActivityEvent** | Activity stream | type, payload, actorId, quoteId | quote | **Yes** |
| **Attachment** | Files | url/storage key, visibility, labels | customer, quote, task… | **Partial** (Phase 2 minimal) |
| **CustomerPreviewShare** / token | Portal later | token, expiresAt, quoteId | quote | **Phase 7** |
| **Job** | Sold container | status | customer, quote | **Phase 4** |
| **RuntimeTask** | Execution task | status, scheduled… | job | **Phase 4** |
| **WorkflowEvent** | Job-level events | type, payload, jobId | job | **Phase 4** |

**Later expansion:** PaymentGate, ChangeOrder, OutcomeRule, CatalogItem, FlowSpecVersion, Request, Notification—see Phase 8 docs.

---

## Likely first APIs / server actions (conceptual)

Naming is illustrative; implement as REST or Server Actions as team chooses.

- `auth.*` — session, org switch  
- `customers.create` / `customers.update` / `customers.get`  
- `opportunities.create` / `opportunities.update` / `opportunities.listByCustomer`  
- `quotes.createDraft` / `quotes.get` / `quotes.updateHeader`  
- `quotes.lineItems.add` / `update` / `remove`  
- `quotes.tasks.add` / `updateStatus` (with `kind` filter)  
- `quotes.readiness.recalculate` (server-side deterministic)  
- `quotes.preview.getCustomerSafeProjection`  
- `quotes.markSent` / `quotes.markAccepted`  
- `jobs.createFromQuote` (Phase 4)  
- `jobs.tasks.complete` (Phase 4)  
- `workStation.feed.query` (Phase 5)

**Rule:** **Readiness** and **preview** run **server-side** so the client cannot spoof pass/fail ([security](../architecture/security/struxient-v4-permissions-matrix.md)).

---

## User flows to prove first (ordered)

1. Login → land in app shell.  
2. Create customer + contact.  
3. Create opportunity → open quote draft.  
4. Add line items + planned tasks + quote-prep tasks.  
5. Watch readiness update → fix blocker → pass.  
6. Open customer preview → confirm no internal fields.  
7. Mark sent → history shows `QUOTE_SENT`.  
8. (Phase 4) Accept quote → create job → complete one runtime task → event logged.

---

## State machines (MVP)

### Opportunity

`New` → `Qualified` → `QuoteDraft` → `QuoteSent` → `Won` | `Lost` | `NoQuote`  
(Allow skipping `Qualified` for fast path; document transition rules.)

### Quote

`Draft` → `MissingInfo` (derived sub-state or flag) → `NeedsReview` → `ReadyToSend` → `Sent` → `Signed` / `Accepted` → (job)  
Side paths: `Declined`, `Revised`, `Expired` (later precision).

### Line item (on quote)

`Draft` | `Complete` (ready for send) | `Optional` | `Allowance` | `Removed`

### Quote task (`QUOTE_PREP` / `PLANNED_EXECUTION`)

Align with [04](../architecture/execution-workflow/04-stages-tasks-outcomes.md) subset for quote surface:

`NotReady` | `Ready` | `InProgress` | `Blocked` | `Waiting` | `NeedsReview` | `Complete` | `Skipped` | `Canceled`

### Job

`PendingActivation` | `Active` | `Blocked` | `Complete` | `Canceled`

### Runtime task

`NotReady` | `Ready` | `InProgress` | `Blocked` | `Waiting` | `NeedsReview` | `Complete` | `CorrectionRequired` | `Skipped` | `Superseded`  
(MVP may use smaller subset; **names** reserved for expansion.)

---

## Readiness MVP (quote send)

**Approach:** Start with **deterministic functions** (or rule rows with simple eval)—**not** a generic rule engine DSL on day one.

### Example checks (MVP)

| Key | Label | Severity | Fail condition (example) | Fix location |
|-----|-------|----------|----------------------------|--------------|
| `customer_contact` | Sendable contact | blocker | No email if send=email | Customer + context |
| `service_address` | Service address | blocker/warning | Missing and not marked TBD | Context |
| `line_items_min` | At least one line | blocker | No active lines | Line items |
| `line_title` | Line titles | blocker | Required line missing title | Line items |
| `line_price` | Line pricing | blocker | Required line missing price/mode | Line items |
| `customer_description` | Customer-facing description | blocker | Template requires and missing | Line items |
| `internal_review` | Internal review | blocker | Flag set and not approved | Internal review |
| `terms` | Terms / disclaimer | blocker | Template requires | Quote header / legal |
| `planned_execution` | Planned tasks | blocker | **Only if** template requires N planned tasks | Planned execution |

Each check: **pass/fail**, **severity**, **explanation string** for UI and future Work Station.

---

## Events MVP (initial catalog)

| Event type | When |
|------------|------|
| `CUSTOMER_CREATED` | Customer created |
| `OPPORTUNITY_CREATED` | Opportunity created |
| `QUOTE_DRAFT_CREATED` | Quote draft created |
| `QUOTE_LINE_ADDED` / `QUOTE_LINE_UPDATED` / `QUOTE_LINE_REMOVED` | Line edits |
| `QUOTE_TASK_ADDED` / `QUOTE_TASK_UPDATED` | Task changes |
| `READINESS_BLOCKER_CREATED` / `RESOLVED` | Optional explicit; or infer from recalc |
| `QUOTE_PREVIEWED` | User opened preview |
| `QUOTE_SENT` | Sent |
| `QUOTE_ACCEPTED` | Accepted/signed manual |
| `JOB_CREATED` | Job from quote |
| `RUNTIME_TASK_COMPLETED` | Task done |

**Uses:** Activity tab; future audit; Work Station “why” text ([05](../architecture/execution-workflow/05-deterministic-execution-engine.md)).

---

## UI principles (first build)

- **Dark mode** default; **shadcn/ui** (or equivalent) for consistent components.  
- **Tight radius**, dense **task-first** layouts ([app-shell](../architecture/app-shell/README.md), [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)).  
- **Left nav** stable; quote workspace is **the** hub for line items + planned execution + readiness + preview.  
- **Progressive disclosure:** advanced fields collapsed.  
- **Clear next action** and **blocker** copy on quote header.  
- **Customer vs internal** labels on fields and tasks ([08](../architecture/execution-workflow/08-customer-view.md)).

---

## Do not build first (explicit)

| Item | Why later |
|------|-----------|
| Full **FlowSpec** visual builder | Prove quote → job first ([flowspec](../architecture/flowspec/struxient-v4-flowspec-builder.md)) |
| Full **drag/drop workflow engine** | Same |
| **Advanced outcome rule editor** | Phase 8 ([04](../architecture/execution-workflow/04-stages-tasks-outcomes.md)) |
| **Full global calendar** | After readiness + runtime tasks ([13](../architecture/execution-workflow/13-calendar-and-scheduling-model.md)) |
| **AI scheduling** | Never black-box; not MVP |
| **Full customer portal** | After quote/send ([customer-portal](../architecture/customer-portal/struxient-v4-customer-portal-mvp.md)) |
| **Full finance/accounting** | Gates later ([finance](../architecture/finance/struxient-v4-finance-and-payment-gates.md)) |
| **Full change order engine** | Later ([change-orders](../architecture/change-orders/struxient-v4-change-orders-and-revisions.md)) |
| **Packet/template marketplace** | Catalog Phase 8 ([catalog](../architecture/catalog/struxient-v4-catalog-packets-and-templates.md)) |
| **Complex analytics** | Later |
| **Partner/vendor portal** | Later ([app-shell 04](../architecture/app-shell/04-login-auth-and-portal-model.md)) |
| **Route optimization / weather** | Later ([13](../architecture/execution-workflow/13-calendar-and-scheduling-model.md)) |

These remain **canon-supported**; they are **sequenced**, not cancelled.

---

## Acceptance criteria (first vertical slice)

- [ ] Internal user can **log in** with tenant context.  
- [ ] User sees **app shell** and **left nav** (skeleton acceptable with placeholders).  
- [ ] User can **create** and **re-open** a **customer**.  
- [ ] User can **create** an **opportunity** linked to that customer.  
- [ ] User can **create a quote draft** from that opportunity.  
- [ ] User can **add / edit / remove line items**.  
- [ ] User can **add simple planned execution tasks** and **quote-prep tasks** (type distinguished).  
- [ ] **Readiness checklist** updates **deterministically** from server rules when data changes.  
- [ ] **Customer preview** shows **only** customer-safe projection.  
- [ ] User can **mark quote Sent**; status and **activity history** update.  
- [ ] **No** quote-prep-only task is copied to a **runtime** job task in Phase 4 when implemented—only **planned execution** activates per rules.  
- [ ] **Quote workspace** remains the **primary** place for line items + planned execution + readiness + preview (no competing “scope app”).

---

## Risks

| Risk | Mitigation |
|------|------------|
| Overbuilding **FlowSpec** too early | Phase gate; stub routes only |
| **Split** quote vs scope UIs | Single quote route owns authoring ([12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)) |
| **Under-modeling** tasks then bolting workflow on | Two `kind`s on quote tasks from day one; runtime separate table in Phase 4 |
| Weak **auth/tenant** | Phase 0 review; every query scoped |
| **No event history** | Minimal `QuoteActivityEvent` from first quote save |
| Readiness hidden in **UI only** | Server recalc + API returns checklist |
| **Preview drift** from quote truth | One projection function from quote model |
| Work Station becomes **vanity dashboard** | Phase 5: only actionable cards + links ([work-station MVP](../architecture/work-station/struxient-v4-work-station-mvp.md)) |
| **Calendar** before readiness | Phase order: 6 after 4–5 |

---

## Assumptions (not canon)

- **Next.js App Router** and **shadcn/ui** are the intended stack per this blueprint prompt; swap if team standard differs.  
- **QuoteVersion** may be **deferred** in favor of events + single quote row for earliest MVP—team should pick before schema.  
- **E-sign** and **real email send** may be **manual status** until integrations exist.

---

## Implementation later (post-blueprint)

- Prisma schema design review against [entity map](../architecture/data-model/struxient-v4-entity-map.md).  
- Seed script for demo tenant.  
- E2E tests for first vertical slice acceptance list.

---

## Open questions (for engineering kickoff)

- Org vs **sub-org** (branches)?  
- **Soft delete** vs hard delete for quotes/customers?  
- **Idempotency** keys for `markSent`?

---

*Clean-slate implementation planning only. No code, schema, migrations, or runtime behavior was changed by creating this document.*
