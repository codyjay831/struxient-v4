# Sales vs Sold Execution

Construction companies live in two different kinds of work **before** and **after** the check clears (or the contract is signed). Struxient canon models that split **explicitly** and uses the **quote** as the **bridge**.

---

## Two workflows (conceptual)

### 1. Pre-send / sales — Opportunity / Sales Workflow

**Purpose:** Win the job and produce an accurate, sellable plan.

**Examples of work:**

- Lead intake  
- Qualify customer  
- Schedule site visit  
- Collect photos  
- Take measurements  
- Confirm AHJ  
- Build quote  
- Review margin  
- Prepare proposal  
- Send quote  
- Follow up  
- Revise quote  

This is **selling and planning**, not **installing**.

---

### 2. Sold execution — Job Execution Workflow

**Purpose:** Deliver what was sold safely, on time, and profitably.

**Examples:**

- Engineering  
- Permit  
- Procurement  
- Install  
- Inspection  
- Correction  
- Closeout  

---

## The quote as bridge

The **quote** connects both sides:

- **Commercial:** line items, price, approvals, terms.  
- **Operational:** planned stages, tasks, estimates, materials, gates, customer milestones, outcome rules.  

**When the deal is sold**, the **sold scope** (especially line items and agreed terms) is what **drives execution tasks** on the job—not a mechanical copy of every sales to-do.

---

## Correct vs incorrect bridging

### Correct (canon)

- **Sales task result data → execution context**  
  Examples:  
  - Panel photo from sales → visible on **install** or **engineering** context  
  - Customer availability from sales → informs **scheduling** readiness  
  - AHJ identified during sales → informs **permit** workflow  
  - Measurements from sales → inform **labor/material estimates** and field notes  

- **Quote sold scope → execution tasks**  
  The **line items** and agreed deliverables seed **what must be done** on the job instance.

### Incorrect (anti-pattern)

- **All sales tasks → execution tasks** automatically.  
  You do not want “review margin” or “send follow-up email” on the **crew’s** “today” list after sell.

---

## Why the split matters (field language)

**Sales reps** care about pipeline, revisions, and margin. **Installers** care about permit, truck stock, and access. **Same company**, **different questions**. One database truth can power **both**, but **different derived feeds** and **different default task sets** after activation.

---

## Examples of carried-forward data (not duplicate tasks)

| Sales phase activity | Data / artifact | Execution use |
|---------------------|-----------------|-----------------|
| Site photos | Image files + notes | Install task context; office preflight |
| Measurements | Wire run length, panel space | BOM; labor estimate; install checklist |
| AHJ confirmation | Jurisdiction + quirks | Permit task template; fees timeline |
| Customer availability windows | Dates/times | Schedule readiness for install |
| Load calc sketch | Engineering input | PE review task; permit package |

None of these require keeping “schedule site visit” as an open **install-phase** task after the visit is done—unless you explicitly model **revisit** as new work.

---

## Canon examples tied to sales vs sold

### Example 3: Customer delay (sold phase)

**Task:** Schedule Install  
**Outcome:** Customer unavailable  

**Actions (conceptual):**

1. Create task: **Get new availability**  
2. Put job in **Waiting on Customer** (derived bucket or explicit state)  
3. **Block** install scheduling tasks as policy dictates  
4. **Keep** permit/procurement tasks **available** if your rules allow work to continue in parallel  
5. **Notify** office  

When customer responds:

1. Complete **Get new availability**  
2. **Unblock** Schedule Install  
3. **Recommend** new install date (engine + scheduler facts)  

This is **sold execution** behavior; it does not belong to the **sales** workflow instance except as historical context.

### Example 4: Scope change (sold phase)

During install, crew finds **extra conduit** needed.

**User action:** Record change event: “Extra conduit needed.”

**Possible system actions:**

1. Create **internal review** task  
2. Create **change order**  
3. **Block** related install slice until approved  
4. **Keep** unrelated tasks available  
5. After approval, **add** new execution tasks  
6. **Supersede** old task if the original approach is invalid  

**History:** Original task existed; change order added tasks; supersession recorded—sales workflow is not rewritten; **job events** tell the story.

---

## Assumptions (not canon)

- Whether opportunity and job are one database row with phases or two linked graphs is implementation.
- Whether “sales workflow” is the same engine with a different template family is likely but not mandated here.

---

## Implementation later

- UX for “handoff summary” at activation (what sales guarantees the field).
- Permissions: sales staff vs production staff vs customer portal.
