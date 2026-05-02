# Execution Workflow — Architecture Canon

## Why these documents exist

Struxient’s next product direction is **execution-first**: the system should tell crews, office staff, and managers **what to do now**, **who should do it**, **why work is ready or blocked**, and **what happens next**—without forcing people to read an entire workflow graph.

These documents capture the **intended product model and execution architecture** so that engineering, product, and field stakeholders share the same vocabulary and rules before implementation. They are a **planning and alignment layer**, not a guarantee of what is already built in the codebase.

## What this is (and is not)

| This folder **is** | This folder **is not** |
|--------------------|-------------------------|
| Product and architecture **canon** for execution workflow | A dump of current v3/v4 code behavior |
| Source material for **future implementation reviews** | Implementation specs with tickets |
| Contractor-friendly explanations with examples | Schema migrations or API contracts |

**Future implementation** should be reviewed against these docs: if code diverges, the team should decide whether to update the product direction (and these docs) or adjust the implementation.

## Main product goal

**Execution-first “what now” clarity** is the center of the product—not quote creation alone, not a generic task board alone, and not a workflow builder as an end in itself. The quote and workflow builder **create the plan**; the active job experience **executes the plan** and surfaces **ready work, blocked work, recommended next work**, and **required follow-ups** in plain language.

## Documents in this folder

| File | Purpose |
|------|---------|
| [01-canon-summary.md](./01-canon-summary.md) | Locked direction and concise canon statements |
| [02-lifecycle-model.md](./02-lifecycle-model.md) | Lead → sales → quote → sold → job → runtime lifecycle |
| [03-quote-to-execution-model.md](./03-quote-to-execution-model.md) | How quotes bridge commercial scope and operational tasks |
| [04-stages-tasks-outcomes.md](./04-stages-tasks-outcomes.md) | Stages, tasks, statuses, preferred order vs dependencies, outcomes |
| [05-deterministic-execution-engine.md](./05-deterministic-execution-engine.md) | Deterministic engine: inputs, outputs, events, recalculation loop |
| [06-sales-vs-sold-execution.md](./06-sales-vs-sold-execution.md) | Pre-send sales workflow vs sold job execution |
| [07-task-dimensions.md](./07-task-dimensions.md) | Full task dimensions (assignments, time, cost, materials, etc.) |
| [08-customer-view.md](./08-customer-view.md) | Customer view as filtered projection of the same truth |
| [09-work-station-what-now.md](./09-work-station-what-now.md) | Work Station, work feed categories, role-aware “what now” |
| [10-open-implementation-questions.md](./10-open-implementation-questions.md) | Open questions for implementation; not answered here |
| [11-lead-intake-to-quote-creation.md](./11-lead-intake-to-quote-creation.md) | Lead intake through quote creation: how opportunities, sales tasks, intake data, customer needs, site data, and quote readiness become a quote draft |
| [12-quote-authoring-ux-and-readiness.md](./12-quote-authoring-ux-and-readiness.md) | Quote authoring workspace: how a quote draft becomes a send-ready proposal through line items, planned execution, pricing, readiness, customer preview, and internal review |
| [13-calendar-and-scheduling-model.md](./13-calendar-and-scheduling-model.md) | Calendar and scheduling model: how Struxient schedules tasks, crews, customers, materials, permits, and readiness-aware work across Work Station, Jobs, and the calendar |

## Worked examples (canon)

Four end-to-end stories used consistently across these docs:

| Example | Where it is spelled out in full |
|--------|----------------------------------|
| **EV Charger quote (Smith residence)** | [04-stages-tasks-outcomes.md](./04-stages-tasks-outcomes.md) (appendix), plus [03](./03-quote-to-execution-model.md), [07](./07-task-dimensions.md), [08](./08-customer-view.md) |
| **Inspection failure → correction loop** | [04](./04-stages-tasks-outcomes.md) appendix, [05](./05-deterministic-execution-engine.md), [09](./09-work-station-what-now.md) |
| **Customer delay (schedule install)** | [04](./04-stages-tasks-outcomes.md) appendix, [06](./06-sales-vs-sold-execution.md) |
| **Scope change / change order** | [04](./04-stages-tasks-outcomes.md) appendix, [06](./06-sales-vs-sold-execution.md), [10](./10-open-implementation-questions.md) |

## How to use this folder

1. **Product and field**: Read `01-canon-summary` and `09-work-station-what-now` first for the “why” and daily experience.
2. **Architecture**: Read `02` through `05` for lifecycle, quote model, stages/tasks/outcomes, and engine behavior.
3. **Lead intake → quote creation**: Read `11-lead-intake-to-quote-creation` for opportunities, intake tasks, quote readiness, prefill, and handoff to a quote draft (pre-send only).
4. **Quote draft → send**: Read `12-quote-authoring-ux-and-readiness` for the quote workspace: line items, planned execution, pricing, readiness, customer preview, and internal review before send.
5. **Calendar and scheduling**: After `09` (Work Station) and `07` (task dimensions), read `13-calendar-and-scheduling-model` for readiness-aware scheduling, calendar lenses, schedule vs calendar truth, and how schedule facts feed execution and customer views.
6. **Implementation planning**: Use `10-open-implementation-questions` to drive spikes and design reviews against the existing codebase and schema.

---

*Canon extraction / execution architecture planning. Not a statement of current production code state unless explicitly noted.*
