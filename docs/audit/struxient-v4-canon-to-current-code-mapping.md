# Struxient v4 Canon to Current Code Mapping Audit

## Purpose

Bridge **product canon** (see [execution-workflow](../architecture/execution-workflow/README.md) and [app-shell](../architecture/app-shell/README.md)) to the **Struxient v4 codebase** so implementers know **what exists**, **what aligns**, **what gaps**, and **what to decide** before building.

This document may contain **current-code observations** where evidence exists. Where the repo was not auditable, entries are marked **not verified** or **Unknown**.

---

## Audit scope

- **In scope:** Map canon concepts to routes, data models, APIs/server actions, services, UI components, and tests **if present** in the Struxient v4 repository.  
- **Out of scope:** Approving schema changes, migrations, or refactors (planning only).

---

## Audit limitations

**Critical limitation (this pass):** A full search of the **Struxient v4** workspace at audit time found **only** documentation under `docs/` (execution-workflow, app-shell, and related architecture folders). **No** `package.json`, **no** Prisma `schema.prisma`, **no** application `*.ts` / `*.tsx` / `*.js` source files, and **no** test files were present in the workspace snapshot used for this audit.

**Implications:**

- Sections **Current Routes Found**, **Current Prisma / Data Models Found**, **Current APIs / Server Actions Found**, and **Current UI Components Found** are **empty** or **not applicable** until application code is checked into this repo (or the audit is re-run against the correct monorepo path).  
- The **mapping table** below uses **Unknown** / **not verified in this repo** for match quality unless you attach the real app tree.  
- **Recommended next action:** Re-run this audit against the repository that contains the Next.js/React app, Prisma schema, and API layer; paste or link evidence paths into the table.

**This is honest scope:** the bridge doc structure is in place; **evidence columns** must be filled by a follow-up audit when code is available.

---

## Existing high-level app shape

**Not determinable from this repository snapshot.** Expected for a full Struxient v4 app (conceptual): internal shell with auth, tenant context, left nav, modules for Work Station, Jobs, Sales, etc.—per [app-shell](../architecture/app-shell/README.md).

---

## Current routes found

**None found** in workspace (no `app/`, `pages/`, or router files in snapshot).

---

## Current Prisma / data models found

**None found** in workspace (no `schema.prisma` or ORM models in snapshot).

---

## Current APIs / server actions found

**None found** in workspace.

---

## Current UI components found

**None found** in workspace.

---

## Mapping table: Canon concept → Current code

| Canon concept | Current code match | Match quality | Evidence / path | Notes | Risk | Recommended next action |
|---------------|-------------------|---------------|-----------------|-------|------|-------------------------|
| OpportunityWorkflowInstance | — | **Unknown** | not verified | Canon: pre-quote sales workflow instance | Medium until modeled | Locate opportunity/lead models in real repo |
| QuoteWorkflowPlan | — | **Unknown** | not verified | Canon: quote as commercial + operational plan | Medium | Map to `Quote` + embedded plan or separate tables |
| JobWorkflowInstance | — | **Unknown** | not verified | Canon: job-owned workflow copy | Medium | Map to job + workflow graph |
| RuntimeTask | — | **Unknown** | not verified | Canon: central operational task at runtime | High | Confirm task table vs `RuntimeTask` naming |
| WorkflowEvent | — | **Unknown** | not verified | Canon: append-style audit/events | High | Event log vs derived audit only |
| Work Station | — | **Unknown** | not verified | Canon: command center UI | Medium | Find dashboard/home routes |
| Catalog | — | **Unknown** | not verified | Packets, line templates | Medium | Catalog module or JSON seeds |
| FlowSpec Builder | — | **Unknown** | not verified | Template authoring | High | Workflow builder routes/services |
| Calendar / Scheduling | — | **Unknown** | not verified | [13](../architecture/execution-workflow/13-calendar-and-scheduling-model.md) | Medium | Calendar components, schedule APIs |
| Customer Portal | — | **Unknown** | not verified | Filtered projection | High | Portal app or route group |
| Customer | — | **Unknown** | not verified | CRM entity | Low | Standard CRM model |
| Sales / Opportunity / Lead Intake | — | **Unknown** | not verified | [11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md) | Medium | Sales routes vs canon stages |
| Finance / Payment Gates | — | **Unknown** | not verified | [finance canon](../architecture/finance/struxient-v4-finance-and-payment-gates.md) | High | Payments tables, gate flags |
| Change Orders | — | **Unknown** | not verified | [change-orders](../architecture/change-orders/struxient-v4-change-orders-and-revisions.md) | High | CO models and events |
| Evidence / Attachments | — | **Unknown** | not verified | [evidence](../architecture/evidence/struxient-v4-attachments-photos-evidence.md) | Medium | File storage, attachment join tables |
| Permissions / Auth | — | **Unknown** | not verified | [security](../architecture/security/struxient-v4-permissions-matrix.md) | High | Auth provider, RBAC tables |
| Requests / Notifications | — | **Unknown** | not verified | [communication](../architecture/communication/struxient-v4-requests-messages-notifications.md) | Medium | In-app notifications, email hooks |

---

## Major alignments

**N/A at repo level** until code is present. **Canon alignment** exists in **documentation** under `docs/architecture/execution-workflow/` and `docs/architecture/app-shell/`.

---

## Major gaps

1. **No executable application** in this workspace snapshot to validate implementation against canon.  
2. **No automated test references** to infer behavior.  
3. **Mapping table** requires population after code audit.

---

## Major conflicts / drift risks

When code **does** exist, watch for:

- **Separate “scope” and “quote”** UIs that duplicate truth vs [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md) single workspace canon.  
- **Sales tasks auto-spawning** job tasks vs [06](../architecture/execution-workflow/06-sales-vs-sold-execution.md).  
- **Template mutation from jobs** vs copy-on-activate canon ([01](../architecture/execution-workflow/01-canon-summary.md)).  
- **Calendar as sole truth** vs schedule facts + readiness ([13](../architecture/execution-workflow/13-calendar-and-scheduling-model.md)).

---

## Keep / reuse candidates

**Not assessed** (no code). In general: keep any **stable** customer/job/quote identifiers and **append-only** audit logs if they already exist—they align with event and history canon.

---

## Do not touch yet

- Do not rename production concepts in code without an ADR—per project rules.  
- Do not collapse modules until this mapping is filled and reviewed.

---

## Recommended build sequencing based on current code

**Cannot be derived from code in this repo.** Use [MVP scope and build order](../planning/struxient-v4-mvp-scope-and-build-order.md) for **canon-driven** sequencing; revisit after code audit.

---

## Open questions

- Where is the **authoritative** Struxient v4 application repository (if not this workspace)?  
- Is v4 a **greenfield** folder inside a larger monorepo?  
- Does v4 share schema with **v3**?

---

## Next audit needed

1. Check in or open the path containing **source code**.  
2. Inventory **routes** (`app/**`, `pages/**`, or framework equivalent).  
3. Export **Prisma schema** or ORM entity list.  
4. List **server actions / API routes**.  
5. Sample **key UI entry points** (Work Station, Quote, Job).  
6. Update this document’s tables with **Strong / Partial / Missing / Conflict** and **file paths**.

---

*Planning / audit documentation only. No code or schema changes performed in this pass.*
