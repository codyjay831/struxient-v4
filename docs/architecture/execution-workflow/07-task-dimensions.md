# Task Dimensions

Tasks are the **center** of day-to-day work. This document lists **dimensions** a task can have in canon—so the **model is rich** even when the **default UI** stays simple.

---

## Identity and description

- **Title** — Short name (“Schedule Final Inspection”).  
- **Description** — Steps, hazards, customer notes.  
- **Stage placement** — Which bucket this belongs to.  
- **Line item association** — Which sold scope line (if any).  
- **Status** — See [04-stages-tasks-outcomes.md](./04-stages-tasks-outcomes.md).  
- **Required vs optional** — Affects stage completion and blocking behavior.  
- **Preferred order** — Soft sequencing hints.  
- **Hard dependencies** — Preconditions for starting.  
- **Source** — Template, line item, manual, correction, change order, AI, customer, AHJ, etc.  

---

## Assignment dimensions

Tasks should support assignment at multiple levels of specificity:

| Level | Example |
|-------|---------|
| **Role** | Office, Estimator, Crew Lead |
| **Team** | Electrical Crew A |
| **Individual** | Mike (and optionally Jose) |
| **External partner** | Engineering firm, AHJ portal work |
| **Unassigned queue** | Triage pool until manager assigns |

**Quote time** might say “Electrical crew.” **Execution time** might narrow to “Mike and Jose on Tuesday.” Canon supports **coarse → fine** assignment without redoing the whole plan.

---

## Time: estimate vs schedule

**Separate on purpose.**

| Type | Meaning | Typical when |
|------|---------|----------------|
| **Time estimate** | “This usually takes ~3 hours.” | Quoting, capacity planning |
| **Scheduled time** | “Booked Tuesday 8:00–11:00 AM.” | Execution, dispatch |

**Schedule readiness** should consider, among other things:

- Task **readiness** (dependencies, gates)  
- **Customer availability**  
- **Crew availability**  
- **Material** and **equipment** readiness  
- **Permit / AHJ** status  
- **Estimated duration**  
- **Payment gates**  

---

## Cost dimensions

Costs may exist at several levels (not all on one field):

- Line item **price** (customer-facing commercial)  
- Task **labor cost** estimate vs actual (implementation later)  
- **Material**, **equipment**, **subcontractor**, **permit** costs  
- **Overhead / margin** at quote or job level  

Canon: **tasks and line items may both carry** cost and resource signals; **line item** remains owner of **what was sold for what price**.

---

## Materials, equipment, orders

- **Material requirements** — SKUs or descriptions, quantities, job links.  
- **Equipment requirements** — Hammer drill, fish tape, ladder class, etc.  
- **Orders** — Purchase orders, will-call, supplier tracking.  

**Attach resources to the work that needs them** so blockers are honest.

**Example:** Install EV charger requires Tesla Wall Connector, 60A breaker, EMT, wire. From that, the system can derive **material list**, **procurement tasks**, **cost estimate**, and **install readiness**.  

**Blocker example:** Install is blocked because **required breaker has not arrived**—a **fact-based** message, not a mystery.

---

## Proof and evidence

- **Required proof** — Photos, forms, test results, signatures.  
- **Attach evidence** as outcome action (see doc 04/05).  

Proof ties to **“why isn’t this ready?”** and **auditability**.

---

## Customer visibility

Per task (and sometimes stage/line item):

- Internal only  
- Customer visible (with **friendly label**)  
- Customer **approval** required  
- Customer **upload/input** required  
- Customer **status-only** (see [08-customer-view.md](./08-customer-view.md))  

---

## Outcome rules

- **Outcome options** — Pass, fail types, reschedule, scope issue, etc.  
- **Outcome-triggered actions** — Create tasks, block stages, notify, require change order, etc.  

Kept **deterministic** and **typed**—not arbitrary scripts.

---

## Event history

Tasks should be explainable over time: assignments changed, rescheduled, failed inspection, reopened. **Events** provide the spine (doc 05).

---

## Concrete task card (illustrative)

**Task:** Install EV Charger  
**Stage:** Install  
**Line item:** Install Tesla Wall Connector  
**Assigned to:** Electrical Crew A (execution: Mike + Jose)  
**Estimated time:** 3 hours  
**Required materials:** breaker, conduit, wire, connector, labels, fasteners  
**Required equipment:** hammer drill, fish tape  
**Hard blockers:** permit approved, payment received, material ready  
**Preferred order:** after order materials, before inspection scheduling (soft)  
**Customer visibility:** show as “Installation”  
**Required proof:** photos + test result  
**Outcome rules:**  
- Completed → unlock inspection scheduling  
- Failed → correction task  
- Customer unavailable → reschedule flow  
- Scope issue → change order review  

---

## Assumptions (not canon)

- Which dimensions are **required at quote save** vs optional is product policy per company template.
- Whether materials are normalized rows or embedded blobs in early MVP is implementation.

---

## Implementation later

- Validation rules when a task claims a material line that conflicts with inventory integration.
- Multi-assignee semantics (all vs any) per task type.
