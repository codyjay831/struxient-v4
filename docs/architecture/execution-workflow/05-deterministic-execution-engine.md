# Deterministic Execution Engine

This document explains what **determinism** means for Struxient, what the engine **reads** and **produces**, how **events** and **outcome rules** fit in, and why **job-local flexibility** does not break determinism—without writing implementation code.

---

## What determinism means here

**Deterministic** does **not** mean “every job runs the same steps in the same order.” It means:

> Given the **same inputs** (workflow instance facts, rules, and recorded events), the system **always derives the same conclusions**: what is complete, ready, blocked, waiting, needing review; what stage state is; what is **recommended next**; what follow-ups are required.

The engine does **not** “think creatively” at runtime. It **evaluates rules against facts** and produces **derived views** (work feed, explanations, stage flags).

**Flexibility** comes from **rich facts** (customer delayed, material late, inspection failed) and **declared rules** (outcomes, dependencies, gates)—not from nondeterministic AI deciding your board every morning.

---

## What facts the engine reads (canon)

Examples of **input facts** the engine should consider:

- Task **statuses** and completion timestamps  
- Stage **statuses** and completion conditions  
- **Hard dependencies** between tasks  
- **Preferred order** hints  
- **Payment gates** (satisfied or not)  
- **Customer availability** / confirmations  
- **Material readiness** (ordered, in transit, received)  
- **Equipment readiness**  
- **Required proof** (photos, forms) present or missing  
- **Outcome rules** attached to tasks  
- **Inspection results** and correction state  
- **Change orders** applied / pending  
- **Manual job events** (recorded explicitly)  
- **Assignments** (who is allowed or responsible)  
- **Schedule facts** (booked windows, conflicts)  

If a fact is **not recorded**, the engine should not invent it. Missing data may surface as **Needs Review** or **Blocked** with a clear “data missing” explanation—product choice.

---

## What outputs the engine derives (canon)

Examples:

- What is **complete** vs **active** vs **not started**  
- What is **blocked**, with **structured reasons**  
- What is **ready now**  
- What is **recommended next** (respecting preferred order without confusing it with legality)  
- What is **waiting** (on customer, AHJ, supplier, …)  
- What **needs review** (approvals, failed checks, ambiguous scope)  
- Which **stage** is active or held  
- Per **role / team / user**: which tasks appear in their **Work Station**  
- What **changed** because of a specific **outcome** (explainable diff)  
- What **should happen next** in terms of **user-visible actions** (open task, collect payment, request photo—not vague nagging)  

---

## Event log model (canon)

Every **meaningful workflow change** should be recordable as a **structured event**. Examples of **event types** (illustrative):

- `WORKFLOW_TEMPLATE_APPLIED`  
- `TASK_ADDED` / `TASK_REMOVED`  
- `TASK_COMPLETED` / `TASK_FAILED` / `TASK_REOPENED`  
- `TASK_ASSIGNED` / `TASK_SCHEDULED` / `TASK_RESCHEDULED`  
- `STAGE_ADDED` / `STAGE_SKIPPED`  
- `DEPENDENCY_ADDED` / `DEPENDENCY_REMOVED`  
- `INSPECTION_FAILED`  
- `CORRECTION_TASK_CREATED`  
- `CHANGE_ORDER_CREATED` / `CHANGE_ORDER_APPLIED`  
- `CUSTOMER_DELAY_RECORDED`  
- `PAYMENT_GATE_SATISFIED`  
- `MATERIAL_REQUIRED` / `MATERIAL_ORDERED` / `MATERIAL_RECEIVED`  
- `EQUIPMENT_REQUIRED`  
- `CUSTOMER_INPUT_REQUESTED` / `CUSTOMER_INPUT_RECEIVED`  

**Current workflow state** (canon): derived from **initial copied template/plan** + **quote/job structural edits** + **event stream**—not from silent edits to the company template.

### Why events matter for contractors

The app should answer in plain language:

- **“Why is this blocked?”**  
- **“Why does this task exist?”**  
- **“What created this correction?”**  
- **“What changed after the inspection failed?”**  

**Example explanation (target behavior):**

> Closeout is blocked because **Final Inspection failed on May 1** and created a **required correction task**. Complete correction work and **schedule reinspection** to unblock Closeout.

That explanation comes from **events + current derived state**, not a hand-written note.

---

## Why outcome rules are deterministic

Outcome rules are **finite lists of allowed action types** with **parameters** (which stage, which task template, which notification channel). At runtime:

1. User or system records **task completed with outcome X**.  
2. Engine applies the **rule set for outcome X**.  
3. Each action is **idempotent** where possible (e.g., “create correction stage if missing” should not create five stages on recalc).  
4. Engine **recalculates** readiness and feeds.

Same outcome + same prior state → same resulting **structural deltas** (modulo explicit timestamps and IDs).

---

## Why job-local flexibility does not break determinism

Jobs diverge from the quote plan all the time: failed inspections, customer delays, extra conduit, crew swaps. **Canon:** those are **new facts** and **new events** (and sometimes **new tasks**), not random UI state.

- Adding a **correction task** changes **facts**; the engine **re-derives** blocked/ready.  
- A **change order** adds or supersedes tasks; events record **what** changed **when**.  
- **Skipping** a task is an **intentional event**, not a hidden delete.

Determinism holds because **flexibility = changes to facts and structure that are themselves recorded**, then **replayed through the same rules**.

---

## Conceptual recalculation flow (pseudo, no code)

```text
Input facts
  → Rule evaluation (dependencies, gates, proofs, stage conditions, outcomes)
    → Ready / blocked / waiting / needs-review calculation
      → Work feed + recommendations + stage states
        → User action (complete task, upload proof, record payment, …)
          → Event recorded (append to log / apply mutation with event)
            → Recalculate (same pipeline)
```

**Loop invariant:** After each batch of events, **re-running derivation** from authoritative state yields the **same** derived feeds.

---

## Assumptions (not canon)

- Whether “authoritative state” is stored as materialized columns plus events, or rebuilt from events only, is an engineering tradeoff for MVP vs scale.
- How often recalculation runs (on every write vs debounced) is operational, not philosophical.

---

## Implementation later

- Rule engine packaging (in-process library vs service).
- Idempotency keys for outcome actions.
- “Explain blocked” query: structured reason objects, not only strings.
- Performance caps for jobs with very large task counts.
