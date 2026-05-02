# Struxient v4 MVP Scope and Build Order

## Purpose

Turn broad **product canon** into **practical build phases** so Struxient v4 does not try to ship everything at once. Aligns with [execution-workflow](../architecture/execution-workflow/README.md), [app-shell](../architecture/app-shell/README.md), and bridge docs under `docs/architecture/*/`, `docs/audit/`, and `docs/planning/`.

**CANON:** Phased delivery with clear **user value**, **must-haves**, and **explicit exclusions**.  
**ASSUMPTION:** Phase labels may be renumbered; dependencies should be validated when [canon-to-code audit](../audit/struxient-v4-canon-to-current-code-mapping.md) is populated.

---

## MVP 0 — Foundation / shell

| | |
|--|--|
| **Goal** | Authenticated, tenant-aware **internal app shell** users can navigate. |
| **User value** | Staff can log in, see stable structure, and reach placeholder or early modules safely. |
| **Must-have** | Auth/login; tenant context; **left nav skeleton** ([app-shell 01](../architecture/app-shell/01-left-navigation-model.md)); basic **permission guard** or role placeholder; core route structure for customer/quote/job if not present. |
| **Out of scope** | Full Work Station feed; FlowSpec publishing; customer portal. |
| **Dependencies** | Auth provider decision; hosting. |
| **Risks** | Wrong tenancy boundaries early → expensive fixes. |
| **Acceptance criteria** | User can sign in, select org (if multi-tenant), land on a **default home**; unauthorized routes blocked server-side (not only hidden nav). |
| **Canon docs** | [04-login-auth-and-portal-model](../architecture/app-shell/04-login-auth-and-portal-model.md), [03-role-based-navigation](../architecture/app-shell/03-role-based-navigation-and-visibility.md) |

---

## MVP 1 — Lead → quote → send

| | |
|--|--|
| **Goal** | **Quote draft → send-ready** for a simple job type. |
| **User value** | Sales can run a lead to a **sent** proposal with basic readiness. |
| **Must-have** | Customers record; lead/opportunity intake ([11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md)); **quote draft**; **line items**; basic **readiness**; **customer preview**; send (real or placeholder per business). |
| **Out of scope** | Sold job execution; full outcome engine; catalog versioning. |
| **Dependencies** | MVP 0. |
| **Risks** | Split quote/scope UIs vs [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md) single workspace. |
| **Acceptance criteria** | Create opportunity → quote → resolve blockers → preview → send; **quote-prep** vs **planned execution** distinguished in UX copy/model where possible. |
| **Canon docs** | [11](../architecture/execution-workflow/11-lead-intake-to-quote-creation.md), [12](../architecture/execution-workflow/12-quote-authoring-ux-and-readiness.md), [03](../architecture/execution-workflow/03-quote-to-execution-model.md) |

---

## MVP 2 — Sold activation → basic job execution

| | |
|--|--|
| **Goal** | **Activate** sold quote → **job** with **runtime tasks** and completion. |
| **User value** | Crew/office can execute a simple sold job on a task list. |
| **Must-have** | Accept/sign/manual activate; **job** created; **runtime tasks** from planned execution ([06](../architecture/execution-workflow/06-sales-vs-sold-execution.md)); complete/reopen basic; **minimal event/audit** trail ([05](../architecture/execution-workflow/05-deterministic-execution-engine.md)). |
| **Out of scope** | Full change orders; complex outcome rules. |
| **Dependencies** | MVP 1. |
| **Risks** | Sales tasks leaking into job board. |
| **Acceptance criteria** | Planned tasks do not copy 1:1 from all sales tasks; activation creates job-owned instance. |
| **Canon docs** | [02](../architecture/execution-workflow/02-lifecycle-model.md), [03](../architecture/execution-workflow/03-quote-to-execution-model.md), [04](../architecture/execution-workflow/04-stages-tasks-outcomes.md) |

---

## MVP 3 — Work Station execution feed

| | |
|--|--|
| **Goal** | **Work Station MVP** aggregates actionable work ([work-station MVP](../architecture/work-station/struxient-v4-work-station-mvp.md)). |
| **User value** | “What now?” without opening every job. |
| **Must-have** | Feeds: **Now**, **Blocked**, **Waiting**, **Needs Review**; basic **role filters**; **deep links** to quote/job/task. |
| **Out of scope** | AI recommendations; full analytics tab. |
| **Dependencies** | MVP 2 task/events sufficient to query. |
| **Risks** | N+1 queries; stale blockers without recalc rules. |
| **Acceptance criteria** | Blocked cards show **reason** string or structured reason MVP. |
| **Canon docs** | [09](../architecture/execution-workflow/09-work-station-what-now.md), [app-shell 02](../architecture/app-shell/02-work-station-surface.md) |

---

## MVP 4 — Calendar / schedule MVP

| | |
|--|--|
| **Goal** | **Readiness-aware** scheduling ([13](../architecture/execution-workflow/13-calendar-and-scheduling-model.md)). |
| **User value** | Book work honestly; see **at risk / blocked** on calendar. |
| **Must-have** | Scheduled tasks; **customer availability** input; crew assignment; **labels** for blocked/at risk. |
| **Out of scope** | Route optimization; weather. |
| **Dependencies** | MVP 2–3. |
| **Risks** | Calendar as only truth—mitigate with facts + labels. |
| **Acceptance criteria** | Changing material fact updates schedule **risk** state without silent success. |
| **Canon docs** | [13](../architecture/execution-workflow/13-calendar-and-scheduling-model.md) |

---

## MVP 5 — Customer portal basics

| | |
|--|--|
| **Goal** | **Filtered** customer surface ([customer portal MVP](../architecture/customer-portal/struxient-v4-customer-portal-mvp.md), [08](../architecture/execution-workflow/08-customer-view.md)). |
| **User value** | Customer sees milestones, uploads photos, confirms availability, approves quote. |
| **Must-have** | Secure or magic link; view quote/proposal; accept/sign concept; uploads; milestones; optional appointment confirm. |
| **Out of scope** | Full messaging product; change order portal (can be stub). |
| **Dependencies** | MVP 1 for quote; auth model decision. |
| **Risks** | Data leaks—enforce projection + server checks. |
| **Acceptance criteria** | Margin/internal notes never returned on customer API. |
| **Canon docs** | [08](../architecture/execution-workflow/08-customer-view.md), [app-shell 04](../architecture/app-shell/04-login-auth-and-portal-model.md) |

---

## MVP 6 — Advanced outcomes, change orders, catalog, FlowSpec, finance depth

| | |
|--|--|
| **Goal** | Power features for production scale. |
| **User value** | Corrections, COs, reusable catalog, published templates, **payment gates** deep integration. |
| **Must-have** (staged internally) | Outcome rules MVP; corrections path; **change orders** ([change-orders](../architecture/change-orders/struxient-v4-change-orders-and-revisions.md)); **catalog/packets** ([catalog](../architecture/catalog/struxient-v4-catalog-packets-and-templates.md)); **FlowSpec** publish/version ([flowspec](../architecture/flowspec/struxient-v4-flowspec-builder.md)); **finance/gates** ([finance](../architecture/finance/struxient-v4-finance-and-payment-gates.md)). |
| **Out of scope** | Full accounting ERP; partner portal. |
| **Dependencies** | MVP 2–5 foundations. |
| **Risks** | Over-engineering simple trades—use progressive UI ([01](../architecture/execution-workflow/01-canon-summary.md)). |
| **Acceptance criteria** | Events for CO/supersession; templates not mutated by jobs. |

---

## Do not build yet (examples)

- Full **event sourcing** replay UI unless needed.  
- **AI** auto-scheduling without explainability.  
- **Partner/vendor** portal (unless committed).  
- **Route optimization** and **weather** scheduling.  
- **Full double-entry accounting** inside Struxient (unless product decides otherwise).

---

## Implementation later

- Phased **feature flags** per tenant.  
- **Performance** budgets for Work Station queries.  
- **Mobile-first** field shell parity.

---

*Planning only. No code or schema changes.*
