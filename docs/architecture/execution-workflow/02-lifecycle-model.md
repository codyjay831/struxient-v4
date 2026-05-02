# Lifecycle Model

This document describes the **intended lifecycle** from first contact through closeout, and **what kinds of things exist** at each phase. Names like `OpportunityWorkflowInstance` are **conceptual** for planning—not a mandate for exact table or class names in code.

---

## End-to-end flow (contractor view)

1. **Lead / opportunity** — Someone might buy work; you capture basics and decide whether to pursue.
2. **Sales workflow** — Qualify, visit site, measure, photos, AHJ notes, build the quote, follow up, revise.
3. **Quote draft** — Commercial + operational plan coming together; not yet committed to the customer.
4. **Quote sent** — Customer has the proposal; you may still revise.
5. **Customer approval / signature** — Sold scope and price are agreed (subject to change orders later).
6. **Activation** — The sold plan becomes an active **job** the crew and office execute.
7. **Job workflow instance** — Job-owned copy of execution structure plus runtime changes.
8. **Runtime execution** — Tasks move; outcomes fire; materials arrive; inspections pass or fail.
9. **Closeout** — Documentation, customer packet, warranty handoff, internal wrap-up.

Canon diagram (conceptual):

```text
Workflow Template
  → copied / customized
Quote / Opportunity Plan
  → sold / activated
Job Workflow Instance
  → executed through events
Runtime Work Feed / Work Station
```

---

## Phase-by-phase: what exists

### Lead / opportunity

**Exists conceptually:**

- **Opportunity** (or equivalent): who, what kind of job, rough value, source.
- **OpportunityWorkflowInstance** (conceptual): the **pre-send / sales** workflow for this deal—lead intake, qualify, site visit, quote prep, send, follow-up, revise.

**Typical contents:** tasks like schedule site visit, collect photos, confirm AHJ, build quote—not install day tasks.

---

### Quote draft and quote sent

**Exists conceptually:**

- **QuoteWorkflowPlan** (conceptual): the quote as **commercial + operational blueprint**:
  - Customer and commercial terms
  - **Line items** (what is sold, price, approved scope)
  - **Planned execution stages** and **planned execution tasks** (what you intend to run after sold)
  - Estimates: labor, materials, equipment
  - Assignment defaults (e.g., “electrical crew” before you know Mike’s Tuesday)
  - Schedule constraints, payment gates, inspection needs
  - Customer-visible milestones and internal tasks
  - **Outcome rules** where you already know how you want the job to react (e.g., inspection fail → correction path)

**Important:** Planning tasks on the quote does **not** mean every sales task becomes a job task after sell; see [06-sales-vs-sold-execution.md](./06-sales-vs-sold-execution.md).

---

### Customer approval / signature → activation

**Exists conceptually:**

- **Sold scope** frozen enough to execute (with change orders as the controlled escape hatch).
- **Activation event** (conceptual): transition from “quoted opportunity” to “active job” with a **JobWorkflowInstance** created or unlocked from the sold plan.

---

### Job workflow instance

**Exists conceptually:**

- **JobWorkflowInstance**: job-owned workflow state—stages, tasks, dependencies, assignments refined to real people and dates, materials linked to tasks, correction loops, change orders.
- **WorkflowEvent** stream: append-only (logically) record of what happened—task completed, inspection failed, material received, etc.

**Current state** (canon): derived from **initial copied plan** + **quote/job-specific structure** + **events**, not by mutating the original company template.

---

### Runtime execution and closeout

**Exists conceptually:**

- **Runtime work feed**: the **derived** lists—now, next, blocked, waiting, needs review, scheduled, done—for each relevant role.
- **Work Station** (conceptual UI): the place users live to answer “what now?” without traversing the whole graph.

---

## Summary table

| Phase | Primary conceptual artifact | Feeds into |
|-------|----------------------------|------------|
| Lead / opportunity | Opportunity + sales workflow instance | Quote planning |
| Quote draft / sent | Quote workflow plan | Customer decision |
| Sold / activated | Job workflow instance | Runtime execution |
| Execution | Events + instance state | Work feed, customer projection |
| Closeout | Same instance; closeout stage/tasks | Completion and history |

---

## Assumptions (not canon)

- Exact naming (`QuoteWorkflowPlan` vs `Quote` + embedded graph) will be decided at implementation time.
- “Activation” might be one event or several (deposit received + signed contract); product must define triggers.

---

## Implementation later

- Define idempotent activation and re-activation (e.g., quote unsign rare cases).
- Define archival and read-only behavior for lost opportunities vs sold jobs.
