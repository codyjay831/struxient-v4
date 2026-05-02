# Struxient v4 FlowSpec Builder

## Purpose

Define **FlowSpec Builder** in detail: reusable **blueprints** for stages, tasks, outcomes, and dependencies. Quotes and jobs **copy** templates into **local instances**; **job execution must not mutate** source templates ([01](../execution-workflow/01-canon-summary.md), [05](../execution-workflow/05-deterministic-execution-engine.md)).

**CANON:** Builder creates **published** reusable logic; **save-back** from quote/job is **explicit** and creates **new** template/version/packet—not silent overwrite.

---

## What is a FlowSpec?

**Conceptual:** A **structured specification** of a workflow: stages, task definitions, outcome rules, gates, default assignments—**machine-readable** enough for deterministic activation (implementation format TBD).

---

## What is a workflow template?

A **named** FlowSpec version intended for **application** to opportunities/quotes/jobs (e.g., “EV Charger — Standard”).

---

## Stage definition

A **bucket** with start/completion conditions, overlap rules, and membership of task definitions ([04](../execution-workflow/04-stages-tasks-outcomes.md)).

---

## Task definition

Blueprint for a **runtime** task: title defaults, required/optional, proof, materials, dependencies, customer visibility mapping.

---

## Outcome rule

For a task type: if outcome X, then **typed actions** (create task, block stage, notify, …) ([04](../execution-workflow/04-stages-tasks-outcomes.md)).

---

## Dependency vs preferred order

**Hard dependency:** cannot start until predecessor satisfied. **Preferred order:** soft sequencing ([04](../execution-workflow/04-stages-tasks-outcomes.md)).

---

## Version

Immutable **published** snapshot vs editable **draft**; jobs/quotes reference **version id** for audit.

---

## Publish / fork / supersede

- **Publish** — promote draft to official version.  
- **Fork** — create variant from existing template.  
- **Supersede** — mark old version deprecated; new jobs use new default (old jobs unchanged).

---

## Template application

**Apply** copies definitions into **QuoteWorkflowPlan** or seeds **JobWorkflowInstance** per activation rules—**never** hot-links live template rows to runtime completion.

---

## Save-back from job/quote

User chooses: **new template**, **new version**, **save packet to Catalog**, or **discard**—per reuse canon.

---

## Interaction with Catalog

FlowSpec **references** catalog packets (task bundles, line templates). Catalog **does not** replace outcome logic on FlowSpec.

---

## Builder modes (UX canon)

- **Simple builder** — wizard for common trades.  
- **Advanced builder** — full graph/stage editor.  
- **Outcome/rule editor** — constrained action types only.  
- **Stage map** — visual timeline.  
- **Task library** — drag from company library + Catalog.  
- **Template version history** — diff, rollback proposal.

---

## Open questions

- Is **FlowSpec** the **customer-facing** name?  
- How much builder ships in **MVP** ([planning](../../planning/struxient-v4-mvp-scope-and-build-order.md) MVP 6)?  
- How to prevent **over-engineering** simple trades? → **Progressive disclosure** + company templates ([01](../execution-workflow/01-canon-summary.md)).

---

## Implementation later

- JSON Schema vs DB-normalized FlowSpec.  
- Simulator: “dry run” outcomes on fake job.  
- Permissions: who can publish ([security](../security/struxient-v4-permissions-matrix.md)).

---

*Planning canon only.*
