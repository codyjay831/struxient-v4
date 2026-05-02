# Struxient v4 Full-Phase Implementation Plan

## Purpose

This document is the **end-to-end implementation plan** for Struxient v4 from **clean-slate foundation** through **advanced workflow features**, while **preserving product canon** and avoiding **architectural drift**.

**Source of truth:** Existing canon and planning docs only—not immature application code.

| Document | Role |
|----------|------|
| [struxient-v4-clean-slate-implementation-blueprint.md](./struxient-v4-clean-slate-implementation-blueprint.md) | First vertical slice, early phases, conceptual routes/models |
| [struxient-v4-mvp-scope-and-build-order.md](./struxient-v4-mvp-scope-and-build-order.md) | MVP phasing, exclusions, acceptance themes |
| [execution-workflow](../architecture/execution-workflow/README.md) | Product truth: quotes, jobs, engine, tasks, customer view, scheduling canon |
| [app-shell](../architecture/app-shell/README.md) | Navigation, Work Station, auth/portals |
| Topic folders under `docs/architecture/` | data-model, work-station, catalog, flowspec, customer-portal, finance, change-orders, evidence, security, communication |

**Critical rule:** This plan lists **all phases**, but **implementation must proceed one phase at a time** with **review and verification** between phases. **Do not** start a later phase until the previous phase’s **acceptance criteria** and **handoff conditions** are met.

---

## Implementation rule

This plan covers **all phases** for roadmap clarity. **Coding must happen one phase at a time.**

Before coding **any** phase:

1. **Create a phase-specific implementation plan** (short doc or ticket bundle: scope, files touched, schema sketch for review only until approved).  
2. **Review against canon** (execution-workflow, app-shell, relevant `docs/architecture/*` topic doc).  
3. **Identify** planned files, models, routes, and permission changes—**no surprises** mid-phase.  
4. **Implement only that phase**—no scope creep into later phases.  
5. **Run build, lint, and tests** for the repo’s standards.  
6. **Verify acceptance criteria** and **handoff conditions** for the phase.  
7. **Only then** branch or plan the next phase.

Skipping reviews **invites drift** (duplicate quote/scope truth, calendar without readiness, portal without projection parity, etc.).

---

## Global build principles

- **Struxient v4 is clean-slate**—no compatibility baggage with legacy apps unless explicitly decided later.  
- **Security-first**, production-safe defaults: HTTPS, secure cookies/sessions, least privilege.  
- **Tenant isolation from day one**—every data access scoped by `organizationId` (or equivalent).  
- **Auth and permissions server-enforced**—UI hiding is not security ([security](../architecture/security/struxient-v4-permissions-matrix.md), [app-shell 04](../architecture/app-shell/04-login-auth-and-portal-model.md)).  
- **Quote workspace** remains the **primary quote-authoring authority**—do not split quote and scope into **competing sources of truth** ([12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)).  
- **Work Station** is the internal **“what now?”** command center—not a vanity dashboard ([09](../architecture/execution-workflow/09-work-station-what-now.md), [work-station MVP](../architecture/work-station/struxient-v4-work-station-mvp.md)).  
- **Scheduling is readiness-aware**, not only a calendar grid ([13](../architecture/execution-workflow/13-calendar-and-scheduling-model.md)).  
- **Customer portal** is a **filtered projection** of the same internal truth ([08](../architecture/execution-workflow/08-customer-view.md), [customer-portal](../architecture/customer-portal/struxient-v4-customer-portal-mvp.md)).  
- **Events/history early enough** to explain changes and unblock Work Station explanations ([05](../architecture/execution-workflow/05-deterministic-execution-engine.md)).  
- **Do not overbuild** FlowSpec, Catalog, AI, full scheduling, or portals **before** the first **quote → send → job → tasks** slice proves stable ([blueprint](./struxient-v4-clean-slate-implementation-blueprint.md)).  
- **Each phase ends in a stable, buildable, shippable** increment (main stays green).

---

## Dependency map

```text
Phase 0 (Foundation)
  └─► Phase 1 (Customers + Opportunities)
        └─► Phase 2 (Quote Workspace MVP)
              ├─► Phase 3 (Send / Acceptance / Revision)
              │       └─► Phase 4 (Job + Runtime Tasks)  ← requires accepted quote path
              │               ├─► Phase 5 (Work Station)  ← needs tasks from 2/4
              │               └─► Phase 6 (Scheduling)   ← needs runtime tasks + ideally Work Station 5
              └─► Phase 7 (Customer Portal)  ← needs 0 auth, 2 quote projection, 3 sent/accept concepts

Phase 8 (Catalog)     → best after Phase 2 proven (insert into quote)
Phase 9 (FlowSpec)    → best after Phases 2 + 4 prove quote/job execution (template apply)
Phase 10 (Outcomes)   → requires Phase 4 runtime tasks
Phase 11 (Finance)    → requires Phase 4 jobs/tasks; quote terms from Phase 2/3
Phase 12 (CO)         → requires Phase 4 + event history; benefits from 10
Phase 13 (Evidence)   → can start after Phase 2; deep proof gates tie to Phase 4/10
Phase 14 (Requests)   → benefits from Phase 5; customer requests tie to Phase 7
```

**Hard ordering:** `0 → 1 → 2 → 3 → 4` is sequential for core product truth. **5** follows **4** (and **2** for quote cards). **6** follows **4** (tasks to schedule). **7** follows **2, 3, 0** minimum. **9 should not start** until **2 and 4** prove quote and job execution. **10** requires **4**. **11** requires **4** and quote/payment fields from **2/3**. **12** requires **4** and strongly benefits from **10** and events.

---

## Cross-phase risks

| Risk | Mitigation |
|------|------------|
| **FlowSpec before** quote/job proven | Gate Phase 9 behind Phase 2 + 4 acceptance |
| **Quote / scope split** returns | Single quote route authority; code review checklist |
| **Calendar before readiness** | Phase 6 only after Phase 4 task + gate facts exist |
| **Portal before** customer-safe projection | Phase 7 only with server-side projection tests |
| **Finance before** job/quote status | Phase 11 after job lifecycle stable |
| **Work Station = dashboard** | Cards must have actions + reasons ([work-station MVP](../architecture/work-station/struxient-v4-work-station-mvp.md)) |
| **Events added too late** | Phase 2 minimum `QuoteActivityEvent`; Phase 4 `WorkflowEvent` |
| **Permissions bolted on late** | Phase 0 RBAC checks on every mutation |
| **Catalog mutates sold work** | Snapshot-on-insert; version ids ([catalog](../architecture/catalog/struxient-v4-catalog-packets-and-templates.md)) |
| **Customer preview drifts** from quote | One projection function; parity tests in Phase 2/7 |

---

# Phase 0 — Foundation / Auth / App Shell

## Goal

Create the **secure base** of the app: runnable app, auth, tenant, shell, placeholders, dark UI baseline, **event baseline planning**.

## Primary user value

Staff can **authenticate** and land in a **real internal product frame** with correct **access boundaries**.

## Canon docs referenced

- [app-shell](../architecture/app-shell/README.md) (nav, Work Station placeholder, auth)  
- [04-login-auth-and-portal-model](../architecture/app-shell/04-login-auth-and-portal-model.md)  
- [security](../architecture/security/struxient-v4-permissions-matrix.md)  
- [blueprint](./struxient-v4-clean-slate-implementation-blueprint.md) Phase 0  

## Main routes / screens

- `/login`  
- `/app` (redirect)  
- `/app/work-station` (placeholder)  
- `/app/admin` (placeholder)  
- `/app/settings` (placeholder)  
- Protected layout: unauthenticated → `/login`

## Conceptual models / entities

- `Organization` (tenant)  
- `User`  
- `Membership` (user ↔ org, role)  
- `Permission` / role enum (minimal)  
- Optional: `AuditEvent` or stub table for Phase 2+

## Likely server actions / APIs

- `auth.signIn` / `auth.signOut` / `auth.session`  
- `org.current` / `membership.get`  
- Middleware: session + org resolution

## UI components / surfaces

- Root layout, app layout, **left nav skeleton** ([01-left-navigation-model](../architecture/app-shell/01-left-navigation-model.md))  
- **shadcn/ui** + Tailwind + **lucide-react**; **dark** theme  
- Work Station placeholder copy (“Feeds arrive in Phase 5”)

## Events / history to create

- Planning only: define **event table name(s)**; optional `USER_LOGIN` if privacy policy allows

## Security / permission notes

- **Server-only** session validation; org id on all server queries  
- Default-deny for `/app/*` without session

## Explicitly out of scope

Customers, opportunities, quotes, jobs, real Work Station feed, FlowSpec, catalog, customer portal, scheduling, finance

## Acceptance criteria

- App runs locally  
- Login route exists  
- Protected `/app` exists; unauthenticated users redirected  
- Authenticated user lands on **`/app/work-station`**  
- Left nav renders  
- Tenant/role **visible in UI or seeded demo data**  
- Build/lint pass  

## Risks / drift warnings

- “Temporary” open routes—**forbid**; use middleware  
- Multi-tenant forgotten on first entity—**enforce org scope** from first insert in Phase 1

## Testing / verification notes

- Manual: login/logout; direct URL to `/app` when logged out  
- Automated smoke: auth redirect (when test harness exists)

## Handoff conditions before Phase 1

- [ ] Auth + org + membership **proven** on server  
- [ ] Pattern for **Prisma + PostgreSQL** agreed (connection, migrations process—**execution** of migrations is out of this doc)  
- [ ] **No** business entities without org id

---

# Phase 1 — Customers + Opportunities / Lead Intake

## Goal

First **sales-side objects** and path from lead → **quote draft creation**.

## Primary user value

User can **capture who wants what** and open a **quote draft** from an opportunity.

## Canon docs referenced

- [11-lead-intake-to-quote-creation](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md)  
- [entity map](../architecture/data-model/struxient-v4-entity-map.md)  
- [06-sales-vs-sold](../architecture/execution-workflow/06-sales-vs-sold-execution.md) (sales lane only)

## Main routes / screens

- `/app/customers`, `/app/customers/[customerId]`  
- `/app/sales/opportunities`, `/app/sales/opportunities/[opportunityId]`  
- Action: **Create quote draft** from opportunity

## Conceptual models / entities

- `Customer`, `CustomerContactMethod`  
- `Opportunity` (status, scope intent, service type, address, source)  
- `OpportunityTask` or checklist (minimal)  
- `Attachment` (optional minimal or placeholder FK only)

## Likely server actions / APIs

- `customers.*`, `opportunities.*`, `opportunities.createQuoteDraft`

## UI components / surfaces

- Customer form/list; opportunity detail; **scope intent** field prominent  
- Link to quote draft when created

## Events / history

- `CUSTOMER_CREATED`, `OPPORTUNITY_CREATED`, `QUOTE_DRAFT_CREATED` (when quote created from opportunity)

## Security / permission notes

- Sales/office roles can create; field **read-only** or **no access** per matrix ([security](../architecture/security/struxient-v4-permissions-matrix.md))

## Explicitly out of scope

Full quote workspace (Phase 2), customer portal, job activation, FlowSpec, advanced AI intake, full comms

## Acceptance criteria

- Create **customer**  
- Create **opportunity** with service type, address, source, **scope intent**  
- **Create quote draft** from opportunity  
- **Opportunity activity** shows key events  

## Risks / drift warnings

- Opportunity tasks accidentally modeled as **future runtime** tasks—keep types separate

## Testing / verification notes

- E2E: customer → opportunity → quote draft link resolves

## Handoff conditions before Phase 2

- [ ] Quote record exists with **customer + opportunity** linkage  
- [ ] Events fire on create paths

---

# Phase 2 — Quote Workspace MVP

## Goal

**Quote workspace** as **primary authoring authority** for commercial + operational plan.

## Primary user value

One place to edit **line items**, **planned execution**, **readiness**, **preview**, **send**.

## Canon docs referenced

- [12-quote-authoring](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)  
- [03-quote-to-execution](../architecture/execution-workflow/03-quote-to-execution-model.md)  
- [08-customer-view](../architecture/execution-workflow/08-customer-view.md)  
- [evidence](../architecture/evidence/struxient-v4-attachments-photos-evidence.md) (notes only)

## Main routes / screens

- `/app/sales/quotes/[quoteId]` — **single hub**: header, context, line items, tasks, pricing/assumptions, readiness, preview modal/page, activity

## Conceptual models / entities

- `Quote`, `QuoteLineItem`  
- `QuoteTask` with `kind`: `QUOTE_PREP` | `PLANNED_EXECUTION`  
- `QuoteReadinessCheck` (computed + persisted optional)  
- `QuoteActivityEvent`  
- `Attachment` (minimal)

## Likely server actions / APIs

- `quotes.update`, `lineItems.*`, `tasks.*`, `readiness.recalculate`, `preview.getProjection`, `quotes.markReadyToSend` / `markSent`

## UI components / surfaces

- Line item table/editor  
- Task lists **split by kind**  
- Readiness checklist panel  
- Customer preview (read-only projection)  
- Internal vs customer-facing labels

## Events / history

- `QUOTE_LINE_*`, `QUOTE_TASK_*`, `READINESS_*`, `QUOTE_PREVIEWED`, `QUOTE_SENT` (when applicable)

## Security / permission notes

- Preview API must **strip** internal fields server-side  
- Edit quote: sales + manager per policy

## Explicitly out of scope

Real e-sign, full portal, job activation, advanced outcomes, full catalog/FlowSpec, **payment processing**

## Acceptance criteria

- Open **quote workspace**  
- Add/edit/remove **line items**  
- Add **planned execution** and **quote-prep** tasks  
- **Readiness** updates deterministically from server rules  
- **Customer preview** hides internal-only data  
- **Mark sent** (or ready→sent) updates status + history  
- **Single source** for line items + planned execution  

## Risks / drift warnings

- Readiness logic only in client  
- Second “scope” route for “real” planning—**reject**

## Testing / verification notes

- Unit tests: readiness rules; snapshot tests: preview JSON shape

## Handoff conditions before Phase 3

- [ ] Sent status distinguishable  
- [ ] History explains major edits

---

# Phase 3 — Send / Acceptance / Quote Revision Placeholder

## Goal

**Post-send** lifecycle: sent, manual accepted/declined, **revision path**, **snapshot** concept.

## Primary user value

Clean handoff to **job activation** without building full e-sign/portal.

## Canon docs referenced

- [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)  
- [change-orders](../architecture/change-orders/struxient-v4-change-orders-and-revisions.md) (revision themes)

## Main routes / screens

- Same quote route; **mode** by status (draft vs sent); revision wizard or explicit “Start revision”

## Conceptual models / entities

- `Quote.status` transitions  
- `QuoteSnapshotAtSend` or version row (conceptual)  
- Guard: **sent** quote edits require **revision** branch

## Likely server actions / APIs

- `quotes.markSent`, `quotes.markAccepted`, `quotes.markDeclined`, `quotes.startRevision`, `quotes.applyRevision`

## UI components / surfaces

- Sent banner; disabled fields unless revising; revision confirmation

## Events / history

- `QUOTE_SENT`, `QUOTE_ACCEPTED`, `QUOTE_DECLINED`, `QUOTE_REVISION_STARTED`, `QUOTE_REVISION_PUBLISHED`

## Security / permission notes

- Who can override sent lock—manager only

## Explicitly out of scope

Full e-sign, payment collection, full portal, legal PDF gen, complex diff UI

## Acceptance criteria

- **Sent** vs **draft** clear  
- **Manual** accepted/signed and declined/lost  
- **Revision explicit**; **original sent** preserved conceptually  
- **Accepted** enables Phase 4 entry  

## Risks / drift warnings

- Allowing silent edit of sent quote—**block**

## Testing / verification notes

- State machine tests for illegal transitions

## Handoff conditions before Phase 4

- [ ] **Accepted** quote has stable reference for job creation  
- [ ] Snapshot or event trail proves “what was sent”

---

# Phase 4 — Job Activation + Runtime Task MVP

## Goal

Sold plan → **job-owned** **runtime tasks**; **no** quote-prep tasks on job board.

## Primary user value

Office/crew can **execute** sold work on a job.

## Canon docs referenced

- [06-sales-vs-sold](../architecture/execution-workflow/06-sales-vs-sold-execution.md)  
- [04-stages-tasks-outcomes](../architecture/execution-workflow/04-stages-tasks-outcomes.md)  
- [entity map](../architecture/data-model/struxient-v4-entity-map.md)

## Main routes / screens

- `/app/jobs`, `/app/jobs/[jobId]` — tasks list, complete action, activity

## Conceptual models / entities

- `Job`, `JobWorkflowInstance` (minimal)  
- `RuntimeTask`  
- `WorkflowEvent` (job)

## Likely server actions / APIs

- `jobs.createFromQuote`, `jobs.activate`, `runtimeTasks.complete`, `runtimeTasks.updateStatus`

## UI components / surfaces

- Job header (customer, quote ref); task list; completion UI

## Events / history

- `JOB_CREATED`, `JOB_ACTIVATED`, `RUNTIME_TASK_COMPLETED`, …

## Security / permission notes

- Field: complete assigned tasks only; manager: broader

## Explicitly out of scope

Advanced outcomes, change orders, full scheduling, full Work Station, portal, payment gates

## Acceptance criteria

- **Accepted** quote creates/activates **job**  
- **Runtime tasks** only from **planned execution**  
- **Complete** tasks; **job activity** shows events  
- **Quote-prep** never copied to runtime  

## Risks / drift warnings

- Copying **all** quote tasks—filter by `kind`

## Testing / verification notes

- Integration: activation produces expected task count

## Handoff conditions before Phase 5

- [ ] Reliable **task completion** + events for feed queries

---

# Phase 5 — Work Station MVP

## Goal

Internal **“what now?”** with **actionable** cards and **deep links**.

## Primary user value

One screen to **prioritize** work across quotes/opps/jobs.

## Canon docs referenced

- [09-work-station](../architecture/execution-workflow/09-work-station-what-now.md)  
- [work-station MVP](../architecture/work-station/struxient-v4-work-station-mvp.md)  
- [app-shell 02](../architecture/app-shell/02-work-station-surface.md)

## Main routes / screens

- `/app/work-station` — feeds, filters, context rail MVP

## Conceptual models / entities

- Read models / queries across `QuoteTask`, `RuntimeTask`, `OpportunityTask`, blockers

## Likely server actions / APIs

- `workStation.feed.query` with role + org filters

## UI components / surfaces

- Cards: quote, opportunity, job, review, blocker ([work-station MVP](../architecture/work-station/struxient-v4-work-station-mvp.md))  
- Context rail: links, one recommended next

## Events / history

- Optional: `WORKSTATION_CARD_CLICKED` analytics later—not MVP blocker

## Security / permission notes

- Feed respects same visibility as underlying records

## Explicitly out of scope

AI prioritization, full analytics, full crew capacity, global calendar, push notifications

## Acceptance criteria

- Land on **Work Station**  
- **Actionable** cards with **why now / why blocked**  
- **Deep links** to quote/job/opp/customer  
- **Not** a vanity dashboard (each card has primary action)

## Risks / drift warnings

- Pretty charts with no actions—reject in review

## Testing / verification notes

- Role-based feed fixture tests

## Handoff conditions before Phase 6

- [ ] Task model has **schedule fields** ready (nullable) for Phase 6

---

# Phase 6 — Calendar + Scheduling MVP

## Goal

**Readiness-aware** scheduling—not calendar-only.

## Primary user value

Honest **when** with **risk/block** explanations.

## Canon docs referenced

- [13-calendar-scheduling](../architecture/execution-workflow/13-calendar-and-scheduling-model.md)  
- [07-task-dimensions](../architecture/execution-workflow/07-task-dimensions.md)

## Main routes / screens

- Work Station **Schedule** tab; optional `/app/schedule`  
- Job detail: schedule strip

## Conceptual models / entities

- `ScheduledSlot` or datetime on `RuntimeTask`  
- `CustomerAvailabilityWindow`  
- `CrewAssignment` (minimal)  
- Schedule readiness label on task

## Likely server actions / APIs

- `tasks.schedule`, `tasks.reschedule`, `availability.*`, `schedule.readiness.recalculate`

## UI components / surfaces

- Week/day list or simple calendar component  
- At-risk / blocked badges

## Events / history

- `TASK_SCHEDULED`, `TASK_RESCHEDULED`, `CUSTOMER_AVAILABILITY_*`

## Security / permission notes

- Customer availability: office/sales edit; field read limited

## Explicitly out of scope

Full drag resource scheduler, AI routes, weather, external calendar sync, complex forecasting

## Acceptance criteria

- Schedule a **task/visit**  
- Appears in **schedule lens**  
- **Blocked/at-risk** explains **why**  
- **Customer availability** influences readiness  
- **Reschedule** recorded  

## Risks / drift warnings

- Calendar UI without **fact checks**—reject

## Testing / verification notes

- Change material fact → scheduled item shows **at risk**

## Handoff conditions before Phase 7

- [ ] **Customer-safe** schedule projection rules drafted for portal

---

# Phase 7 — Customer Portal MVP

## Goal

**Filtered** customer participation.

## Primary user value

Customer can **see proposal**, **upload**, **confirm availability**, see **milestones**.

## Canon docs referenced

- [customer-portal MVP](../architecture/customer-portal/struxient-v4-customer-portal-mvp.md)  
- [08](../architecture/execution-workflow/08-customer-view.md)  
- [app-shell 04](../architecture/app-shell/04-login-auth-and-portal-model.md)

## Main routes / screens

- `/portal/[token]`, `/quote`, `/uploads`, `/schedule` (conceptual)

## Conceptual models / entities

- `PortalAccessToken` (scoped, expiring)  
- Read-only projection DTOs

## Likely server actions / APIs

- `portal.session`, `portal.quote.get`, `portal.upload`, `portal.availability.submit`, `portal.quote.accept` (if feasible)

## UI components / surfaces

- Milestone strip; upload widget; availability picker

## Events / history

- `PORTAL_QUOTE_VIEWED`, `CUSTOMER_UPLOAD_RECEIVED`, `CUSTOMER_AVAILABILITY_SUBMITTED`

## Security / permission notes

- Token scope; rate limit; **no internal fields** in DTOs  
- Automated tests for projection leakage

## Explicitly out of scope

Full messaging, payment processing, full account mgmt, partner portal, complex e-sign

## Acceptance criteria

- **Secure** access  
- **Only** customer-safe projection  
- **Upload** works  
- **Availability** confirm works  
- **Internal** margin/notes hidden  

## Risks / drift warnings

- Duplicating quote data for portal—**reuse projection** from Phase 2 logic

## Handoff conditions before Phase 8

- [ ] Insertion path from **catalog** won’t break portal projection (preview parity mindset)

---

# Phase 8 — Catalog + Packets MVP

## Goal

**Reusable** line templates and **packets**; **snapshot** on insert.

## Primary user value

Faster quoting with consistent scope + tasks.

## Canon docs referenced

- [catalog](../architecture/catalog/struxient-v4-catalog-packets-and-templates.md)  
- [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md)

## Main routes / screens

- `/app/catalog`, editor for template/packet, “Insert into quote” from quote workspace

## Conceptual models / entities

- `CatalogLineTemplate`, `CatalogPacket` (defaults: lines, tasks, assumptions, descriptions)

## Likely server actions / APIs

- `catalog.*`, `quotes.insertPacket` (copy snapshot)

## UI components / surfaces

- Catalog list; packet composer (simple); insert modal

## Events / history

- `CATALOG_PACKET_INSERTED`, `QUOTE_LINE_ADDED` (from catalog)

## Security / permission notes

- Only authorized roles edit catalog ([security](../architecture/security/struxient-v4-permissions-matrix.md))

## Explicitly out of scope

Marketplace, deep inventory, nested packets, AI generation

## Acceptance criteria

- Create **template/packet**  
- **Insert** into quote → **copied** defaults  
- **Catalog edits** do not mutate **sent/sold** quotes/jobs  

## Risks / drift warnings

- Live FK from job line to catalog row for semantics—prefer **snapshot ids**

## Testing / verification notes

- Change catalog after insert—quote unchanged

## Handoff conditions before Phase 9

- [ ] “Apply template” and “insert packet” share **copy** semantics for Phase 9 FlowSpec apply

---

# Phase 9 — FlowSpec Builder MVP

## Goal

**Reusable workflow templates**; **apply** copies locally; **no** runtime mutation of source.

## Primary user value

Company standards for stages/tasks/deps; apply to new quotes/jobs.

## Canon docs referenced

- [flowspec](../architecture/flowspec/struxient-v4-flowspec-builder.md)  
- [01-canon-summary](../architecture/execution-workflow/01-canon-summary.md) (template immutability)

## Main routes / screens

- `/app/flowspec`, template list, editor, publish, apply-to-quote/job

## Conceptual models / entities

- `WorkflowTemplate`, `StageDefinition`, `TaskDefinition`, `TemplateVersion`, publish/draft

## Likely server actions / APIs

- `flowspec.templates.*`, `flowspec.applyToQuote`, `flowspec.applyToJobPlan`

## UI components / surfaces

- List + simple stage/task editor (not full node graph)

## Events / history

- `TEMPLATE_PUBLISHED`, `TEMPLATE_APPLIED_TO_QUOTE`, `TEMPLATE_APPLIED_TO_JOB`

## Security / permission notes

- Publish: admin/manager only

## Explicitly out of scope

Advanced visual node editor, full outcome DSL, nested composition

## Acceptance criteria

- Define **simple template**  
- **Apply** to quote/job plan → **local copy**  
- **Template edit** does not change **active jobs**  
- **Publish/fork** explicit  

## Risks / drift warnings

- Skipping Phase 2/4 proof—**gate** this phase behind acceptance

## Testing / verification notes

- Apply template twice → idempotent or versioned behavior documented

## Handoff conditions before Phase 10

- [ ] Task graph supports **outcome** attachment points (even if outcomes stubbed)

---

# Phase 10 — Outcome Rules + Corrections MVP

## Goal

**Deterministic** construction reactions ([04](../architecture/execution-workflow/04-stages-tasks-outcomes.md)).

## Primary user value

Failed inspection / unavailable customer creates **correct** follow-ups.

## Canon docs referenced

- [04](../architecture/execution-workflow/04-stages-tasks-outcomes.md)  
- [05](../architecture/execution-workflow/05-deterministic-execution-engine.md)

## Main routes / screens

- Task completion modal with **outcomes**; optional simple rule editor (admin)

## Conceptual models / entities

- `OutcomeRule`, `OutcomeAction` (typed enum only)  
- Correction tasks linkage

## Likely server actions / APIs

- `tasks.completeWithOutcome`, `engine.applyOutcomeActions` (server-side)

## UI components / surfaces

- Outcome picker; blocked banners on dependent tasks

## Events / history

- `TASK_COMPLETED`, `OUTCOME_APPLIED`, `CORRECTION_TASK_CREATED`

## Security / permission notes

- Who can pick “override” outcomes—manager

## Explicitly out of scope

Arbitrary scripting, AI auto-actions, complex DSL

## Acceptance criteria

- Complete with **outcome** → **deterministic** follow-ups  
- **Correction** completable  
- **Blocked** work shows **reason**  
- **History** explains chain  

## Risks / drift warnings

- Non-idempotent outcome application—design **idempotency keys**

## Testing / verification notes

- Same outcome applied twice → stable state

## Handoff conditions before Phase 11

- [ ] **Block/unblock** hooks exist for payment facts

---

# Phase 11 — Finance + Payment Gates MVP

## Goal

**Payment gates** affect readiness/scheduling/task start ([finance](../architecture/finance/struxient-v4-finance-and-payment-gates.md)).

## Primary user value

Office can **enforce deposit/progress** without full accounting.

## Canon docs referenced

- [finance](../architecture/finance/struxient-v4-finance-and-payment-gates.md)  
- [13](../architecture/execution-workflow/13-calendar-and-scheduling-model.md)

## Main routes / screens

- Quote: payment terms; Job: gates list; Finance stub `/app/finance` or job subpanel  
- Work Station: **payment blocker** card

## Conceptual models / entities

- `PaymentGate`, `PaymentRecord` (manual), link to quote/job

## Likely server actions / APIs

- `gates.define`, `gates.markSatisfied`, `finance.recordManualPayment`

## UI components / surfaces

- Gate badge on task; office form for “received deposit”

## Events / history

- `PAYMENT_GATE_SATISFIED`, `PAYMENT_RECORDED`

## Security / permission notes

- Field workers **no margin**; finance/office record payments

## Explicitly out of scope

Processor integration, full invoicing, tax compliance, collections automation

## Acceptance criteria

- Quote defines **requirement**  
- **Unsatisfied** gate **blocks** task/stage per rules  
- **Office** marks satisfied → blocker clears  
- **Explanation** updates  
- **Field** does not see restricted finance  

## Risks / drift warnings

- Client-side gate checks only—**server enforce**

## Handoff conditions before Phase 12

- [ ] **Price delta** and approval flags available for CO UI

---

# Phase 12 — Change Orders / Revisions MVP

## Goal

**Sold work changes** with history ([change-orders](../architecture/change-orders/struxient-v4-change-orders-and-revisions.md)).

## Primary user value

Safe **scope/price** updates mid-job.

## Canon docs referenced

- [change-orders](../architecture/change-orders/struxient-v4-change-orders-and-revisions.md)  
- [08](../architecture/execution-workflow/08-customer-view.md) (customer approval)

## Main routes / screens

- Job → **Change orders** tab; CO detail; link to portal approval (if Phase 7)

## Conceptual models / entities

- `ChangeOrder`, `ChangeOrderLine`, task supersession records

## Likely server actions / APIs

- `changeOrders.create`, `apply`, `requestCustomerApproval`, `supersedeTasks`

## UI components / surfaces

- CO wizard; diff summary; approval status

## Events / history

- `CHANGE_ORDER_CREATED`, `CHANGE_ORDER_APPLIED`, `TASK_SUPERSEDED`

## Security / permission notes

- Customer approves via portal token; manager can apply internal-only COs if policy allows

## Explicitly out of scope

Full legal e-sign, complex partial approvals, accounting sync

## Acceptance criteria

- **Create CO** from job  
- **Add** tasks; **supersede** with history  
- **Customer approval** tracked when required  
- **Original** scope explainable  

## Risks / drift warnings

- Silent task replace—always **event + link** to CO

## Handoff conditions before Phase 13

- [ ] Attachments can link to **CO** and **correction** tasks

---

# Phase 13 — Evidence / Attachments / Closeout MVP

## Goal

**First-class** files and **proof** ([evidence](../architecture/evidence/struxient-v4-attachments-photos-evidence.md)).

## Primary user value

Proof drives **readiness** (e.g., inspection); closeout has a **packet** placeholder.

## Canon docs referenced

- [evidence](../architecture/evidence/struxient-v4-attachments-photos-evidence.md)  
- [07](../architecture/execution-workflow/07-task-dimensions.md)

## Main routes / screens

- Attachments panel on customer/opp/quote/job/task; upload UI in portal (Phase 7 integration)

## Conceptual models / entities

- `Attachment` (polymorphic parent), `EvidenceRequirement` on task template/runtime

## Likely server actions / APIs

- `attachments.upload`, `attachments.link`, `tasks.submitProof`

## UI components / surfaces

- File list, labels, visibility toggles; closeout checklist

## Events / history

- `ATTACHMENT_ADDED`, `TASK_PROOF_SATISFIED`

## Security / permission notes

- Signed URLs, virus scan **later**; MVP minimum safe storage ACLs

## Explicitly out of scope

OCR/AI interpretation, advanced file versioning, CDN optimization

## Acceptance criteria

- Attach to **multiple** record types  
- **Require proof** to complete task when configured  
- **Customer-safe** files in portal; **internal** hidden  
- **Closeout** placeholder tracks required docs  

## Risks / drift warnings

- Orphan files without parent id—reject uploads without linkage

## Handoff conditions before Phase 14

- [ ] **Request** can reference attachment requirement (feeds Phase 14)

---

# Phase 14 — Requests / Messages / Notifications MVP

## Goal

Structured **asks** + **surfacing** without noise ([communication](../architecture/communication/struxient-v4-requests-messages-notifications.md)).

## Primary user value

“Upload panel photo” and “Approve discount” become **first-class** queue items.

## Canon docs referenced

- [communication](../architecture/communication/struxient-v4-requests-messages-notifications.md)  
- [work-station](../architecture/work-station/struxient-v4-work-station-mvp.md) Requests tab

## Main routes / screens

- Work Station **Requests** tab; request detail; optional in-app notification bell

## Conceptual models / entities

- `Request` (type, status, assignee, source record)  
- `Notification` (pointer to request/task; read state)

## Likely server actions / APIs

- `requests.create`, `complete`, `notifications.list`, `markRead`

## UI components / surfaces

- Request row/card; context rail summary

## Events / history

- `REQUEST_CREATED`, `REQUEST_COMPLETED`, `NOTIFICATION_SENT`

## Security / permission notes

- Customer requests scoped to portal token; internal requests respect RBAC

## Explicitly out of scope

Full SMS/email automation, full chat, complex preference matrix

## Acceptance criteria

- **Create** request (customer/internal)  
- Appears in **Work Station**  
- **Complete/close** lifecycle  
- Notification **links** to source—**not** source of truth  

## Risks / drift warnings

- Email as SOA—in-app record remains authoritative

## Testing / verification notes

- Request completion idempotency

## Handoff conditions (ongoing product)

- [ ] Operational runbooks for support  
- [ ] Performance review for feeds at scale

---

## Assumptions (not canon)

- **Next.js App Router**, **TypeScript**, **Prisma/PostgreSQL**, **shadcn/ui**, **Tailwind**, **lucide-react** as in Phase 0 spec—adjust if stack differs.  
- Phase **9** start may slip until **8** is stable—dependency map is **logical**, not calendar.

---

*Planning document only. No code, app files, schema, migrations, packages, or runtime behavior were changed by authoring this file.*
