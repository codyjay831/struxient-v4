# Quote Authoring UX and Readiness

## Purpose

This document defines the **intended quote authoring experience** in the **quote workspace**: from **quote draft created** through **quote sent**. It **zooms into** the workspace where estimators and sales staff turn context into a **send-ready proposal**—not lead intake before the draft (see [11-lead-intake-to-quote-creation.md](./11-lead-intake-to-quote-creation.md)), and not **sold job execution** after approval (see [03](./03-quote-to-execution-model.md), [06](./06-sales-vs-sold-execution.md)).

**User journey framed here:**

> “I have a draft quote” → “This proposal is internally reviewed, customer-readable, operationally planned, and ready to send.”

**Complements:** [app-shell](../app-shell/README.md) (where **Sales** and **Work Station** live in navigation), execution-workflow docs on quotes, tasks, customer view, and determinism.

Nothing here asserts that **current** Struxient UI matches this model unless you verify separately.

---

## Canon summary

- The **quote is not just pricing**. It is the **commercial + operational blueprint** ([03](./03-quote-to-execution-model.md)).  
- The quote workspace authors **both**: (1) **customer-facing commercial proposal**, (2) **internal planned execution model**—in one coherent place.  
- The workspace must **not** feel like a disconnected “scope page” and a disconnected “quote page.”  
- **Canon statement:** The **quote workspace** is the **primary authority** where **line items**, **pricing**, **customer-facing scope**, **planned execution** (tasks, stages, materials, assumptions), **readiness blockers**, **customer preview**, and **internal review** come together.  
- If a **deeper scope/planning lens** exists for very large quotes, it is a **focused secondary view** opened **from** the quote, reading/writing the **same plan**—not a competing source of truth (see **Single authority** below).

---

## Quote authoring flow

End-to-end inside the workspace (conceptual):

```text
Quote Draft
  → Add / refine customer and job context
  → Add line items
  → Add task/stage planning (planned execution)
  → Add pricing and assumptions
  → Resolve readiness blockers
  → Preview customer proposal
  → Complete internal review
  → Send quote
```

The user should **always** be able to answer:

| Question | Canon direction |
|----------|------------------|
| What is **missing**? | **Readiness / send checklist** + inline gaps (derived from facts). |
| What can I do **next**? | **Next recommended action** in header or checklist. |
| Is this **draft-ready**? | **Draft readiness** threshold (policy/template). |
| Is this **send-ready**? | **Send readiness** threshold (stricter). |
| What will the **customer** see? | **Customer preview** = projection of send payload. |
| What is **internal only**? | Explicit **internal** labels; preview hides them ([08](./08-customer-view.md)). |
| What work is **planned if sold**? | **Planned execution** section—dormant until activation. |
| What **blocks** sending? | **Blockers** with what / why / who / where / send vs warn. |

---

## Quote workspace primary areas (conceptual)

Exact UI layout is **not** mandated. These are **conceptual sections**:

1. **Quote header / status**  
2. **Customer + job context**  
3. **Line items**  
4. **Planned execution**  
5. **Pricing + assumptions**  
6. **Readiness / send checklist**  
7. **Customer preview**  
8. **Internal review**  
9. **Activity / change history**

---

## 1. Quote header / status

**Should answer:** Which quote? Which customer? What **status**? Who owns it? When updated? **Next recommended action**? **Quote total** at a glance?

### Status examples (conceptual)

Draft; Missing Info; Needs Internal Review; Ready to Send; Sent; Signed; Declined; Expired; Revised (and company-specific variants).

### Header surfaces (canon)

- Quote **total** (customer-facing total where applicable)  
- **Customer** and opportunity/job **address**  
- Current **readiness** state (draft vs send)  
- **Primary action** appropriate to state, e.g.: Continue draft; Resolve blockers; Preview proposal; Submit for review; Send quote; Revise quote  

**Determinism:** Primary action and status should follow **rules + facts**, not hidden toggles ([05](./05-deterministic-execution-engine.md)).

---

## 2. Customer + job context

**Purpose:** Everything needed to **author** accurately—**visible**, not buried.

**May include:** Customer name and contacts; service address; service type; opportunity source; **scope intent**; photos/files; site notes; measurements; AHJ/jurisdiction; customer availability; customer constraints; **internal notes**; prior customer/job history when relevant.

**Sources:** Lead intake, customer record, uploads, site visit, manual entry ([11](./11-lead-intake-to-quote-creation.md)).

**Examples of “usable context”:**

- **Panel photo** visible while adding EV charger line item  
- **Measurements** visible while estimating labor/material  
- **AHJ** visible while adding permit-related planned tasks  
- **Availability** visible when stating schedule assumptions  

---

## 3. Line items

**Line items own commercial scope** ([03](./03-quote-to-execution-model.md)). They answer: **What** is sold? What does the customer **approve**? **What** does it cost? What **scope**? What is **included/excluded**?

### Fields (may include)

Title; customer-facing description; quantity; unit/total price; pricing mode; taxable; discount/adjustment; internal notes; included/excluded language; linked catalog/packet; **linked planned execution** tasks; material/labor assumptions; customer visibility; optional/alternate/allowance/pending-review flags.

### Sources

Manual; catalog; reusable packet; AI suggestion (human-confirmed); previous job; scope intent; site visit finding.

### Line item modes (canon)

Required item; optional add-on; alternate option; allowance / pending review; (later) customer-selectable option if product supports.

**Canon reminder:** **Tasks** own execution detail; **stages** organize timing; **line items** anchor what is **sold**.

---

## 4. Planned execution

**Purpose:** Plan **how** work would run **if** sold—not “the job has started.”

**May include:** Stages; tasks; assignments by role/team; preferred order; hard dependencies; required proof; materials/equipment; procurement needs; estimated duration; schedule assumptions; payment gates; inspection needs; outcome rules ([04](./04-stages-tasks-outcomes.md), [07](./07-task-dimensions.md)).

**Tasks may attach to:** Quote overall; specific line item; stage; customer request; internal review need; planned execution package.

### Quote-prep tasks vs planned execution tasks

| Type | Examples | Lane |
|------|----------|------|
| **Quote-prep** | Review margin; add missing email; confirm panel photo; manager approve quote | **Sales/quote** lifecycle; **not** auto-becoming job crew tasks |
| **Planned execution** | Submit permit; order breaker; install charger; schedule inspection; upload closeout photos | On quote as **planned/dormant**; **activate** to runtime job tasks **only** on sell/activation per rules ([06](./06-sales-vs-sold-execution.md)) |

---

## 5. Pricing + assumptions

**Pricing** connects to **scope**: line item totals; labor/material/equipment estimates; permit fees; sub costs; discounts; tax; margin (if shown in workspace); deposit/payment requirement; **payment gates** ([03](./03-quote-to-execution-model.md)).

**Assumptions** should be **visible** and typed where possible:

- Customer-facing vs internal-only  
- Approval-required  
- Linked to **readiness** blocker or warning  
- Linked to optional/conditional line item  

**Examples:** Price assumes panel capacity; wire run under 40 ft; drywall repair excluded; permit fee estimated; customer provides access during business hours.

---

## 6. Readiness / send checklist

**Two thresholds** ([11](./11-lead-intake-to-quote-creation.md)):

1. **Draft readiness** — Minimum to **create and keep editing** a useful quote.  
2. **Send readiness** — All **gates** satisfied before **customer** receives the proposal.

Readiness is **derived from facts**, not hidden UI state ([05](./05-deterministic-execution-engine.md)).

### Readiness categories (examples)

Draft; Missing Info; Needs Customer Response; Needs Site Review; Needs Internal Review; Ready to Preview; Ready to Send; Sent.

### Send blockers (examples)

Missing customer contact; missing job address; missing required line item title/price; missing customer-facing description; missing required photo/site data; incomplete internal approval; margin below threshold; incomplete permit/AHJ check for template; missing terms/disclaimer; missing deposit/payment setting; missing **required** planned execution for template.

### Each blocker should state

- **What** is missing  
- **Why** it matters  
- **Who** can fix it  
- **Where** in the workspace to fix it  
- **Block send** vs **warn only**  

**Blocker example:**  
*Quote send blocked: customer email missing. Fix: Customer + Job Context → add email.*

**Warning example:**  
*Permit fee estimated. Send allowed; ensure customer-facing assumption is included.*

---

## 7. Customer preview

**Purpose:** Show **exactly** what the customer will see **before** send.

**Include (when applicable):** Customer name; company branding; address; line items; pricing; included/excluded; assumptions; optional/alternates; payment terms; timeline/milestones if offered; customer actions (accept, sign, ask question, select option, upload if requested).

**Must hide:** Internal notes; margin; internal task names; crew assignments (unless intentionally customer-visible); manager approval tasks; internal risk notes; raw supplier cost breakdowns if policy says so ([08](./08-customer-view.md)).

**Connection to readiness:** If required customer-facing text is missing, preview shows **gap** or preview is **incomplete** per rules.

---

## 8. Internal review

**Purpose:** Company-side **approval** before send—**task-based** and **deterministic** where possible.

**May include:** Manager approval; margin approval; scope risk; safety; permit/AHJ; finance/payment; production feasibility; senior estimator sign-off.

### Rule examples (illustrative)

- Margin below threshold → **Manager review** task  
- Electrical permit scope → **AHJ check** required  
- Unsafe photo → **Safety review** task  
- Discount over threshold → **Approval** task  

### Review outcomes (examples)

Approved → quote can progress; needs changes → **quote-prep** tasks; declined / no-quote → opportunity path; escalated → assigned review task.

---

## 9. Activity / change history

**Purpose:** Quotes are **explainable** and **auditable**.

**Meaningful events (examples):** Draft created; line item added/removed/updated; price changed; context updated; photo attached; planned execution task added; blocker created/resolved; review requested/approved/rejected; preview generated; sent; revised.

**Supports:** Why the quote changed; sales history; revisions; audit; **activation truth** later ([05](./05-deterministic-execution-engine.md)).

---

## User experience principles

- Users should not **hunt** for the next step: **next action**, **blockers**, **section-level** progress, **inline warnings**, preview access, **internal-only** labels, **save as template/packet** where product allows ([01](./01-canon-summary.md) reuse levels).  
- **Same model, different depth:** Fast quote vs guided vs complex ([11](./11-lead-intake-to-quote-creation.md) paths)—not different incompatible architectures.

---

## Single authority: no competing truth

**Canon:** The **quote workspace** is the main quote-authoring authority.

**Avoid:**

- Quote page = price only; “real” scope elsewhere  
- Hidden task planning disconnected from line items  
- Duplicate truth between “quote” and “scope”  

**Secondary lens (if any):** Focused scope/planning for **very large** jobs; opened **from** quote; **same** underlying quote plan; **optional** for ordinary quotes.

---

## Work Station connection

[09-work-station-what-now.md](./09-work-station-what-now.md); [app-shell Work Station](../app-shell/02-work-station-surface.md).

**Examples:**

**NOW:** Add missing price to Smith quote; review margin for Jones quote; send ready quote.

**BLOCKED:** Send blocked—missing email; manager approval required; missing panel photo.

**WAITING:** Customer photo; estimator site notes.

**NEEDS REVIEW:** Low margin; permit risk; unclear optional scope.

Work Station **deep links** into the **correct section** of the quote workspace (contextual URL or equivalent—implementation later).

---

## Sales / customer / job connections

- Workspace sits in **Sales** (pre-send) until sold ([06](./06-sales-vs-sold-execution.md)).  
- Links: **Customer** record; **Opportunity**; intake facts; **Catalog**; planned execution; **customer preview/portal**; **Finance** terms; **Job** activation after signature/approval.

**When sold:** Sold line items + planned execution **seed** job workflow instance; **quote-prep** tasks do **not** become job execution tasks; customer-approved terms preserved; **activation rules** decide which planned tasks become **runtime** tasks ([03](./03-quote-to-execution-model.md)).

---

## Worked example: EV charger quote authoring

1. **Draft** created from opportunity—customer wants EV charger.  
2. **Context:** Address; panel + charger location photos; AHJ; rough wire run.  
3. **Line item:** Install Tesla Wall Connector — $1,850.  
4. **Planned execution:** Permit (submit permit); Procurement (order breaker/materials); Install (mount, conduit, wire, breaker, test); Inspection (schedule final); Closeout (photos, customer packet).  
5. **Assumptions:** Panel has capacity; run under 40 ft; drywall excluded; permit fee estimated separately.  
6. **Blocker:** Panel appears full → **send blocked** until panel/load review complete.  
7. **Internal review:** Manager approves send with **conditional** customer-facing language.  
8. **Customer preview:** Line item, price, assumptions, conditional panel note, payment terms—**no** margin or internal review labels.  
9. **Send:** Status **Sent**; opportunity → **Quote Sent / Follow-Up** ([11](./11-lead-intake-to-quote-creation.md)).

---

## Deterministic rule examples

| Rule | Effect |
|------|--------|
| No sendable customer contact | **Block** Send. |
| Required line item missing price | **Block** Send. |
| Margin below company threshold | **Require** internal review before send. |
| Required customer-facing description missing | **Block** preview completeness or **block** send per template. |
| Template requires planned execution before send and none exist | **Block** Send. |
| Permit-related scope and AHJ missing | **Block** or **warn** per template. |
| Customer-visible assumption missing for allowance item | **Block** Send until satisfied. |

Same facts + same template rules → same readiness outcome ([05](./05-deterministic-execution-engine.md)).

---

## Assumptions (not canon)

- Exact **UI layout** and section names are not decided.  
- Quote workspace may live under **Sales** route ([app-shell 01](../app-shell/01-left-navigation-model.md)).  
- Some companies allow **minimal** planned execution before send; **complex trades** may **require** it—**template/company** configurable.  
- Customer preview may be **portal**, **PDF**, or **both**—implementation later.  
- **Existing code** may not yet match this canon.

---

## Implementation later

- Map canon to **current** quote workspace implementation.  
- **Quote readiness rule engine**; explicit **draft vs send** matrices.  
- Data model split: **quote-prep tasks** vs **planned execution tasks**.  
- **Customer preview** projection service and parity tests.  
- Internal review **tasks**, permissions, and escalation paths.  
- **Quote revision** after Sent (versioning, customer diff).  
- **Activation mapping**: quote plan → `JobWorkflowInstance` (conceptual).  
- **Save as Catalog packet / Save as template** from quote ([01](./01-canon-summary.md)).  
- Section-level completion UX; customer vs internal notes model.
