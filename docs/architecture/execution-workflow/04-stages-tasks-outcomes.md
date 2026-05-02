# Stages, Tasks, and Outcomes

This document explains how **stages**, **tasks**, **statuses**, **preferred order**, **dependencies**, and **outcomes** fit together in the canon model.

---

## Stages

A **stage** is a **meaningful bucket of work**, not just a visual column.

**Examples:** Lead Intake, Site Visit, Quote Prep, Engineering, Permit, Procurement, Install, Inspection, Correction, Closeout.

### What a stage should “know” (canon)

- Which **tasks** belong in this stage  
- Which tasks are **required** for stage progress  
- Whether the stage **blocks** later stages or can **overlap**  
- Whether work is primarily **office**, **field**, **customer**, **AHJ**, or **partner**  
- **Preferred order** relative to other stages (when not overlapping)  
- **Start conditions** (what must be true to start)  
- **Completion conditions** (usually: required work + proofs + gates satisfied—not “someone clicked done on the stage”)  

### Example: Site Visit stage

**Required tasks (example):**

- Visit scheduled  
- Site photos uploaded  
- Measurements complete  
- Notes submitted  

**When those complete:**  
**Site Visit** stage → **Complete**; **Quote Prep** (or next stage per template) → **Ready**.

### Overlap example

- **Procurement** may start after **sign** even if **permit** is still pending.  
- **Install** cannot start until **permit approved**, **material ready**, **customer available** (if required), and **payment gate** satisfied—whatever the template encodes.

Stages are **execution structure**: they drive **what can be ready** and **what blocks downstream**.

---

## Tasks

The **task** is the **central operational object** in canon.

### Task can include (non-exhaustive)

- Title, description  
- **Stage** placement  
- **Line item** association (when applicable)  
- **Status** (see below)  
- **Required** vs **optional**  
- **Preferred order** within stage or across tasks  
- **Hard dependencies** (cannot start until …)  
- **Assignment:** role, team, individual, partner, or queue  
- **Time estimate** vs **scheduled window** (see doc 07)  
- Labor/material/equipment needs  
- **Required proof**  
- **Customer visibility** and customer-facing label  
- **Outcome options** and **outcome-triggered actions**  
- **Source** (why this task exists)  
- **Event history** (via linked events)  

### Task sources (examples)

Template, quote line item, manual quote edit, manual job edit, inspection correction, change order, AI suggestion, customer request, AHJ requirement.

**Why it matters:** When someone asks **“why is this task here?”**, the system should answer from **source + events**, not guesswork.

---

## Preferred order vs hard dependencies

**Not the same.**

| Concept | Meaning | Example |
|--------|---------|---------|
| **Preferred order** | “Do this first **if possible**.” | Order material before scheduling install. |
| **Hard dependency** | “This **cannot start** until that is done/satisfied.” | Install cannot start until **material received** and **permit approved**. |

**Story:** You might **schedule** install before material arrives (customer coordination), but the **install task** stays **Not Ready** or **Blocked** until **material received** is factually true. Preferred order keeps the UI **suggesting** sensible sequencing without falsely locking scheduling.

The system should be able to show:

- **Ready now**  
- **Recommended next**  
- **Available but lower priority**  
- **Blocked** (with reasons)  
- **Waiting** (external or customer)  
- **Needs review**  

---

## Task statuses (recommended conceptual set)

- **Not Ready** — Preconditions not met  
- **Ready** — Can be started  
- **In Progress** — Actively being worked  
- **Blocked** — Cannot proceed until specific facts change  
- **Waiting** — Often external (customer, AHJ, supplier)  
- **Needs Review** — Human decision required  
- **Complete** — Satisfied as far as this task is concerned  
- **Skipped** — Intentionally not needed for this job  
- **Canceled** — Removed from this job’s active plan  
- **Superseded** — Replaced by newer scope / change order  
- **Correction Required** — Was “done” but failed inspection or similar  

**Distinctions (contractor-friendly):**

- **Skipped** = “We didn’t need this on **this** job.”  
- **Canceled** = “This is **off** the job.”  
- **Superseded** = “A **newer** task/version replaced this one; history kept.”  
- **Correction Required** = “Work came back **not acceptable**; correction path exists.”  

---

## Outcomes

Tasks do not only “complete.” They can complete **with an outcome** that reflects reality.

### Example: Final Inspection

**Possible outcomes:**

- Pass  
- Fail: field correction  
- Fail: engineering revision  
- No access  
- Inspector rescheduled  

Each outcome can trigger a **structured, limited action list** (deterministic operations—see doc 05).

### Example: Fail — Field Correction

**Actions (illustrative):**

1. Create **Correction** stage if missing  
2. Create task: **Review correction notice**  
3. Create task: **Perform field correction**  
4. Create task: **Upload correction photos**  
5. Create task: **Schedule reinspection**  
6. **Block** Closeout  
7. Set Inspection stage to **Correction Required**  
8. **Notify** office and crew lead  

After correction work completes, **reinspection** becomes **Ready**. If reinspection **passes**, Inspection stage → **Complete**, Closeout → **Ready**.

---

## Outcome actions (safe, deterministic categories)

Canon examples of allowed action **types** (not an exhaustive implementation list):

- Create task / stage  
- Reopen / block / unblock / skip task  
- Require review / payment / customer approval / change order  
- Schedule follow-up  
- Move task to another stage  
- Mark stage complete or failed / correction required  
- Attach evidence requirement  
- Notify role / team / user  
- Create material/order requirement  
- Create customer request or partner task  

**Canon:** Outcome rules are **data + engine**, not ad-hoc scripts per customer.

---

## Appendix: Four worked examples (canon)

The following examples are **product canon** for how stages, tasks, outcomes, and actions fit together. They are **not** claims about current code.

---

### Example 1: EV Charger quote (Smith residence)

**Quote:** Smith Residence EV Charger  

**Line item:** Install Tesla Wall Connector — $1,850  

**Stages and tasks (illustrative):**

| Stage | Tasks |
|-------|--------|
| **Site Visit** | Confirm charger location; measure wire run; photograph panel |
| **Permit** | Confirm AHJ; submit electrical permit |
| **Procurement** | Order breaker; prepare conduit/wire |
| **Install** | Mount charger; run conduit; pull wire; install breaker; test charger |
| **Inspection** | Schedule final inspection; meet inspector; resolve correction if needed |
| **Closeout** | Upload completion photos; send warranty/customer packet |

**Assignments (illustrative):** Site visit → estimator; Permit → office; Install → electrical crew; Inspection → office/crew lead; Closeout → office.

**Materials:** Breaker, conduit, wire, wall connector, labels, fasteners.

**Customer view milestones (illustrative):** Quote sent → Site review complete → Permit in progress → Installation scheduled → Inspection pending → Project complete.

**Outcome rule (illustrative):** If inspection fails → create correction path; block closeout; schedule reinspection (details in Example 2).

---

### Example 2: Inspection failure

**Task:** Final Inspection  
**Outcome:** Failed — Field Correction  

**Engine actions (ordered conceptually):**

1. Mark Final Inspection as **Correction Required** (or equivalent).  
2. Create **Correction** stage if missing.  
3. Create task: **Review correction notice**.  
4. Create task: **Complete field correction**.  
5. Create task: **Upload correction photos**.  
6. Create task: **Schedule reinspection**.  
7. **Block** Closeout.  
8. **Notify** office and crew lead.  

**After** correction tasks complete: **Reinspection** task becomes **Ready**. If reinspection **passes**: Inspection stage → **Complete**; Closeout → **Ready**.

---

### Example 3: Customer delay

**Task:** Schedule Install  
**Outcome:** Customer unavailable  

**Actions:**

1. Create task: **Get new availability**.  
2. Put job in **Waiting on Customer** (derived or explicit—implementation later).  
3. **Block** install scheduling (per policy).  
4. **Keep** permit/procurement tasks **available** if rules allow parallel work.  
5. **Notify** office.  

**When customer gives availability:**

1. Complete **Get new availability**.  
2. **Unblock** Schedule Install.  
3. **Recommend** new install date (from schedule facts + readiness).  

---

### Example 4: Scope change (extra conduit)

**Situation:** During install, crew finds **extra conduit** needed.  

**User action:** Create change event: **Extra conduit needed**.  

**Possible system actions:**

1. Create **internal review** task.  
2. Create **change order**.  
3. **Block** related install task(s).  
4. **Keep** unrelated tasks available.  
5. After approval, **add** new execution tasks.  
6. **Supersede** old task if the original install task is no longer valid as written.  

**History preserved:** Original task existed; change order added tasks; supersession recorded when applicable; **new** task is active.

---

## Other cross-references

- **Inspection failure** and **blocked explanations** — [05](./05-deterministic-execution-engine.md), [09](./09-work-station-what-now.md).  
- **Customer delay** and **scope change** — also [06](./06-sales-vs-sold-execution.md).  
- **Open implementation questions** — [10](./10-open-implementation-questions.md).

---

## Assumptions (not canon)

- Exact enum names and number of statuses will be tuned with UX and engineering.
- Whether “Waiting” is a status or a derived bucket is implementation detail; canon cares that **waiting on customer** is visible and explainable.

---

## Implementation later

- Authoring UI for outcome rules with validation (no arbitrary code).
- Stage policy DSL vs fixed templates per trade.
