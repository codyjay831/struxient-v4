# Quote-to-Execution Model

The **quote** is not only pricing. In canon, it is the **commercial + operational blueprint**: what you sell, for how much, and **how you plan to deliver it** (stages, tasks, resources, constraints, and rules).

---

## How quotes create operational truth

### Line items vs tasks

| Concern | **Line items** answer | **Tasks** answer |
|--------|------------------------|------------------|
| Role | **What** is sold and **what scope** the customer approves | **What must happen** to deliver that scope |
| Examples | “Install Tesla Wall Connector — $1,850” | Mount charger, pull wire, permit, inspection |
| Owns | Commercial scope, price, sold deliverable | Execution detail: who, when, proof, materials, outcomes |

**Canon rule:** The **line item owns commercial scope**. **Stages** organize **timing and buckets**. **Tasks** connect **scope** to **work**—often many tasks per line item across **multiple stages**.

**Example (EV charger):**

- **Line item:** Install Tesla Wall Connector — customer sees price and approved install scope.
- **Tasks** may span:
  - **Site visit:** confirm charger location  
  - **Permit:** submit electrical permit  
  - **Procurement:** order breaker / materials  
  - **Install:** mount, conduit, wire, breaker, test  
  - **Inspection:** schedule, meet inspector  
  - **Closeout:** photos, warranty packet  

So: one sold line item → many operational tasks, **not** one task per line item by default.

---

## Tasks inside the quote

Canon allows:

- Tasks **generated from** line items (template or line-item rules).
- Tasks **added manually** during quoting (e.g., “extra AHJ research for this address”).
- Tasks that are **execution-relevant** but **only activate or appear on the job** after sell (product decision: “dormant until sold” vs “visible but not assignable”—implementation later).

**Execution-relevant** tasks (install, permit submission, etc.) should not be treated as the same lifecycle as **pure sales** tasks (review margin, internal discount approval).

---

## Tasks outside line items

Some tasks exist for **job hygiene** or **regulatory** reasons without a clean 1:1 line item:

- Internal coordination
- Partner coordination
- Corrections after inspection
- Change-order-driven work

They still belong to the **job workflow instance** and should have a **source** explaining why they exist (see [07-task-dimensions.md](./07-task-dimensions.md)).

---

## What the quote can carry (canon checklist)

The quote/plan can include, among other things:

- Customer identity and contact context  
- Sales / pre-send workflow state (separate lane from sold execution—see doc 06)  
- **Line items** (sold artifacts)  
- **Planned execution stages**  
- **Planned execution tasks** (with full dimension support in the model, even if UI starts simple)  
- Labor/time **estimates**  
- Cost breakdown (labor, material, equipment, subs, permits, margin)  
- Equipment requirements  
- Material / order requirements  
- Team/role **assignment defaults**  
- Schedule **constraints** (not necessarily final schedule)  
- Payment **gates**  
- Inspection requirements  
- Customer-visible **milestones**  
- **Outcome rules** (what happens on pass/fail/delay/scope issue)  

---

## Bridge: quote → job

**Correct mental model:**

- **Quote sold scope** (line items + agreed terms) → drives **which execution tasks** belong to the job and what can be billed.
- **Sales task result data** → carries forward as **execution context** (photos, measurements, AHJ, availability)—not as a pile of duplicate “sales” tasks on the install board.

**Incorrect model:**

- Automatically turning **every** sales task into a **runtime execution** task after sell.

---

## Concrete mini-example

**Quote:** Smith Residence EV Charger  
**Line item:** Install Tesla Wall Connector — $1,850  

On the quote you already plan stages (Site Visit → … → Closeout) and attach tasks. When the customer signs:

- The **job** gets a **workflow instance** seeded from that plan.  
- **Crew-facing “what now”** comes from **job task readiness**, not from re-living “follow up on quote email” on the field board.  
- **Panel photos** taken during sales show up as **context** on install or permit tasks because they were stored as **facts**, not because “upload panel photo” is still an open install task.

---

## Assumptions (not canon)

- Whether dormant tasks are stored on the quote row graph only or duplicated at job creation is an implementation choice.
- How tightly line items bind to accounting/invoicing is outside this doc’s scope but must stay consistent with “line item owns commercial scope.”

---

## Implementation later

- Rules for cloning quote plan → job instance (deep copy, ID mapping, supersession on change orders).
- Explicit “task activation policy” per task type (sales-only, quote-only, job-runtime).
