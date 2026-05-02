# Lead Intake to Quote Creation

This document extends the [execution workflow canon](./README.md) for the path from **first contact** to a **real quote draft** (and readiness to send). It stays **consistent** with existing docs: sales/pre-send workflow is **separate** from sold execution; the **quote** is the **bridge**; **sales task outputs** carry forward as **context**; **sales tasks** do not automatically become **runtime execution** tasks; the **quote** is the **commercial + operational blueprint**; **tasks** remain central; the **Work Station** still answers **“what now?”**—here, for **sales and estimators** as well as the field.

**Scope:** Pre-quote and quote-creation. **Not** the focus: sold job execution (see [06-sales-vs-sold-execution.md](./06-sales-vs-sold-execution.md), [03-quote-to-execution-model.md](./03-quote-to-execution-model.md)).

Nothing in this file asserts what is already implemented in the codebase unless you verify it separately.

---

## Purpose

Explain how Struxient gets from:

> **“Someone might want work done”**

to:

> **“A quote draft exists with customer info, line items, task/stage planning, costs, materials, schedule assumptions, and a clear readiness state.”**

The doc should help product and implementation planning answer:

- Who is the customer, and what do they want?
- Where is the job, and is it worth quoting?
- What information is **missing** vs **nice to have**?
- Do we need a site visit, photos, measurements, AHJ research, or manager sign-off **before** sending?
- Are we **ready to create** a quote vs **ready to send**?
- What **line items** and **execution plan** should be **prefilled** from intake facts?

---

## Canon Summary

| Canon | In this path |
|-------|----------------|
| Lead intake is **not** a throwaway contact form | It **creates or updates an Opportunity** and drives a **sales / pre-quote workflow**. |
| **Opportunity** | Possible job + customer + requested scope + **intake facts** + **readiness** toward quote creation. |
| **Sales / pre-quote** vs **sold execution** | Intake and quote-prep tasks stay in the **opportunity/sales** lane; they do **not** auto-clone to the **job execution** board after sell (see doc 06). |
| **Quote as bridge** | Quote draft holds **commercial + operational blueprint** for what you might sell; **planned execution** detail can live on the quote as **planned/dormant** until activation (see doc 03). |
| **Carry-forward** | Task **outputs** (photos, measurements, AHJ, availability) become **quote and later execution context**—not “every sales task” as install tasks. |
| **Tasks central** | Intake creates **tasks** with **outcomes**, not only static fields. |
| **Determinism** | Same facts + same template + same readiness rules → same **missing info**, **blocked send**, **suggested next action** (see section below). |
| **Work Station** | Sales users see **Now / Next / Blocked / Waiting / Needs Review** for **pre-quote** work (see doc 09 patterns). |
| **Customer view** | Limited **milestones** and **customer tasks** during intake/quote; internal margin/discount work stays internal (see doc 08). |

---

## End-to-End Flow

Conceptual sequence (company templates may compress or expand stages):

```text
Lead Source
  → Lead Intake
  → Opportunity Created / Updated
  → Sales / Pre-Quote Workflow Instance
  → Intake Tasks
  → Site / Customer / Scope Facts Collected
  → Quote Readiness (create vs send)
  → Quote Draft Created
  → Quote Line Items + Planned Execution Details Added
  → Quote Review
  → Quote Sent / Follow-Up
```

**Alignment with [02-lifecycle-model.md](./02-lifecycle-model.md):** This path covers **Lead / Opportunity** through **Quote Draft** and **Quote Sent**; activation and **Job Workflow Instance** are out of scope for this document.

---

## Core Objects

These names are **conceptual** for planning—not mandated table or API names.

| Object | Role |
|--------|------|
| **Lead source** | Where the lead came from (web, referral, partner, walk-in, campaign). Feeds reporting and routing. |
| **Opportunity** | A **possible job**: customer (or prospect), requested service/scope, links to intake facts, **quote readiness**, optional quote(s), sales owner, priority, qualification. |
| **OpportunityWorkflowInstance** | The **pre-quote / sales** workflow for this opportunity—stages, **sales and quote-prep tasks**, outcomes. |
| **Intake fact** | Structured or semi-structured data captured during intake (address, AHJ, photos, measurements, urgency, constraints). Feeds **readiness** and **prefill**. |
| **Scope intent** | What the customer **asked for** before a priced line item exists (e.g., “EV charger install in garage”). May drive suggested line items and templates. |
| **Quote draft** | Commercial + operational blueprint in progress: customer, line items, planned stages/tasks, estimates, materials assumptions, gates, customer-facing copy. |
| **Quote line item** | Sold-artifact-in-waiting: title, customer description, price/pricing mode, quantity, internal notes, optional **planned execution** attachments, visibility, optional outcome rules (see doc 03). |
| **Quote prep task** | Sales/estimator work **on the opportunity or quote** (e.g., review margin, add line items, get manager approval)—**not** sold execution. |
| **Planned execution task** | Task rows on the **quote** that describe **how** work would be done **after** sell (permit, install, inspection). Canon: they are **planned/dormant** until activation; they are **not** the same lifecycle as “call customer” (see **Sales Tasks vs Planned Execution Tasks** below). |

---

## Lead Intake Data

Lead intake should capture **enough** to decide **what happens next**. **Templates** and **service type** should define **required** fields—not one global required set for every company.

### Customer (examples)

Name, phone, email, preferred contact method, service address, billing vs contact if needed, access notes, availability windows, urgency, referral/source notes.

### Job / request (examples)

Service type, requested work, problem description, desired timeline, uploaded photos/files, site conditions, address / AHJ / jurisdiction, existing equipment, rough measurements, budget expectation if given, special constraints, safety concerns, HOA/property manager notes, permit likelihood, **whether a site visit is needed** (fact or task outcome).

### Business / sales (examples)

Lead source, sales owner, priority, qualification status, estimated value, fit/no-fit reason, follow-up date, **quote readiness** (derived category), internal notes.

**Canon:** The system should **surface missing required info** clearly—not demand perfection before **creating** a draft if policy allows (see **Quote Readiness**).

---

## Opportunity Workflow Stages

**OpportunityWorkflowInstance** is the **pre-quote / sales** workflow. Stages are **conceptual**; names vary by template, trade, and company.

Illustrative progression:

1. **New Lead** — Triage and contact validation.  
2. **Qualification** — Fit, priority, basic scope confirmation.  
3. **Info Gathering** — Photos, questions, access notes.  
4. **Site Visit / Remote Review** — On-site or remote sufficiency decision; measurements; photos.  
5. **Quote Prep** — Template selection, line items, labor/material, **planned execution** tasks, customer-facing text.  
6. **Internal Review** — Margin, scope assumptions, manager approval if required.  
7. **Quote Ready** — Proposal packaging, customer preview, **send** when readiness satisfied.  
8. **Quote Sent / Follow-Up** — Still opportunity-side until sold (then lifecycle continues per doc 02).

### Example: stages and tasks (illustrative)

**New Lead:** Review lead details; confirm contact method; confirm service address.

**Qualification:** Call customer; confirm requested service; decide fit/no fit; set priority.

**Info Gathering:** Request photos; review photos; follow-up questions; collect access notes.

**Site Visit / Remote Review:** Decide if site visit required; schedule visit; complete visit; upload measurements/photos; mark site data complete.

**Quote Prep:** Select quote template; add line items; add labor/material estimates; add **planned execution** tasks; add customer-facing descriptions.

**Internal Review:** Review margin; review scope assumptions; manager approve if required; confirm sendable.

**Quote Ready / Sent path:** Prepare proposal; preview customer view; send quote; follow-up tasks as needed.

Stages should advance on **conditions** (tasks complete, facts present), not only on manual “next column” clicks—same philosophy as execution stages ([04-stages-tasks-outcomes.md](./04-stages-tasks-outcomes.md)).

---

## Intake Tasks and Outcomes

Lead intake should **materialize as tasks** on the **opportunity workflow**, not only as a static form submission.

### Example intake / pre-quote tasks

Review new lead; call customer; confirm service address; request photos; review uploaded photos; schedule site visit; complete site visit; measure work area; confirm AHJ; check permit requirement; build quote draft; manager review; send quote.

These are **sales / opportunity / quote-prep** tasks. They **do not** automatically become **sold execution** tasks. Their **outputs** carry forward (photos → quote context; AHJ → permit planning; availability → scheduling context).

### Carry-forward examples (canon)

| Task | Output | Carry-forward use |
|------|--------|-------------------|
| Request panel photo | Panel photo | Quote builder; permit planning; **context** for planned install after sell |
| Confirm customer availability | Windows | Site visit scheduling; **assumptions** for install scheduling after sell |
| Confirm AHJ | Jurisdiction | Permit line/stage planning; cost assumptions; execution template rules |

### Lead / opportunity task outcomes (examples)

**Call customer:** Reached → spawn info-gathering tasks as needed; Voicemail → follow-up task; Bad number → contact needs review; Not interested → **lost**; Wants quote now → **create quote draft** path.

**Review photos:** Enough info → quote prep ready; Need more photos → customer photo request; Site visit required → schedule site visit; Unsafe condition → manager review task.

**Site visit:** Complete → quote prep ready; Not home → reschedule; Scope larger than expected → **scope intent** / review task; Unsafe → manager review / no-quote path.

**Manager review:** Approved → quote send-ready (subject to other gates); Revise scope → quote prep tasks; Declined / no-fit → **no-quote**; Needs change → assign estimator/office task.

Outcome actions should remain **typed and deterministic** (create task, set opportunity state, block send, notify)—aligned with [05-deterministic-execution-engine.md](./05-deterministic-execution-engine.md).

---

## Quote Readiness

**Creating** a quote and **sending** a quote are **different** readiness thresholds.

### Readiness categories (conceptual)

Examples of **derived** categories the UI might show:

- **Ready to create quote** — Minimum facts satisfied for **draft** creation (policy-dependent).  
- **Missing required info** — Specific gaps listed (not a vague “incomplete”).  
- **Needs customer response** — Waiting on photos, answers, or approval.  
- **Needs site visit** — Template or outcome requires on-site data.  
- **Needs internal review** — Margin, safety, or scope review outstanding.  
- **Needs AHJ / permit check** — Jurisdiction or permit path not satisfied for **send** (or for **certain line items**).  
- **Ready to send** — All **send gates** satisfied for this template/company.

### Example: draft vs send

**Quote draft may be allowed when** (illustrative policy):

- Customer (or prospect) record exists  
- Job address exists **or** is explicitly marked “unknown / TBD” per template rules  
- Requested **service type** exists  
- At least one **scope intent** or placeholder for line items exists  

**Quote send should be blocked when** (illustrative):

- Required customer contact missing (e.g., no email if send is email)  
- Required line item pricing missing  
- Required internal approval incomplete  
- Required site data missing **for this template**  
- Required customer-facing terms or disclosures missing  

**Canon:** Companies may **create early drafts** and **finish tasks** before send—readiness should **explain** what is missing for **each** threshold.

---

## Quote Creation Paths

The architecture should support **multiple paths** without forcing heavy workflow on simple trades.

| Path | Sketch |
|------|--------|
| **A: Fast quote** | Intake → create quote immediately → line items → send (minimal tasks). |
| **B: Guided quote** | Intake → sales tasks → photos/site visit → quote draft → review → send. |
| **C: Complex quote** | Qualification → site visit → AHJ → engineering/prelim review → quote with **full execution plan** → manager review → send. |
| **D: No quote** | Disqualify / archive / lost / no-fit with **reason preserved**. |
| **E: Repeat customer** | Select customer → new opportunity → reuse known site/context → quote draft. |

**Canon:** One **model**; **templates** and **company settings** control how much structure is visible by default ([01-canon-summary.md](./01-canon-summary.md) progressive UI principle).

---

## Quote Builder Prefill

**Intake facts** should **prefill** quote creation where possible.

### Service type = EV charger (example)

- Suggest **EV charger quote template**  
- Suggest **line item packet** (e.g., install EV charger)  
- Suggest **stages**: Permit, Procurement, Install, Inspection, Closeout  
- Suggest **required photos**: panel, charger location, path  
- Suggest **tasks**: confirm AHJ, check panel capacity, estimate wire run (as **quote-prep** or **planned execution** per product rules)  

### If customer uploaded photos

Attach as **quote context**; surface in quote builder; optionally link to **planned execution** tasks as **context** (not as “job started”).

### If AHJ is known

Prefill permit expectations; add permit **stage/task** to plan; permit fee placeholders if configured.

### If measurements are known

Prefill labor/material estimates; inform quantities; store as **quote assumptions**.

### If availability is known

Store as **scheduling context**; show estimated install windows in quote **only** if product/policy appropriate (often post-sell).

---

## Line Items from Intake

**Scope intent** can exist before priced line items.

**Customer:** “I need an EV charger in my garage.”  
**Opportunity:** Scope intent = EV charger install requested.  
**Later on quote:** Line item = “Install Tesla Wall Connector — $1,850” with **planned execution** across Permit → Closeout.

### Line item creation sources (canon)

Manual entry; from template; from **packet**; from AI suggestion after intake review; from **similar past job**; from customer request text; from **site visit findings**.

Line items should be able to carry: title, customer-facing description, price/pricing mode, quantity, internal notes, **attached planned execution** (stages/tasks), material/labor assumptions, customer visibility, optional outcome rules and gates—aligned with doc 03.

---

## Sales Tasks vs Planned Execution Tasks

| Kind | Examples | Lane |
|------|----------|------|
| **Sales / quote-prep task** | Review margin; call customer; request photos; manager approve discount | Opportunity / quote prep; **never** implied as post-sell crew task |
| **Planned execution task** | Submit permit; install charger; final inspection | Lives on **quote** as **plan for after sell**; activates on **job** per activation rules (doc 03, doc 06) |
| **Customer-facing line item** | “Install EV charger” — what customer approves and pays for | Commercial scope owner |

**Canon clarity:** “Review margin” is not an execution task for the install crew. “Submit permit” on the quote is **operational planning**, not a duplicate of “left voicemail with customer.”

---

## Work Station During Lead / Quote Phase

The **Work Station** applies to **sales users** during intake and quote: same **categories** as [09-work-station-what-now.md](./09-work-station-what-now.md), different filters.

**NOW (examples):** Review new lead; call customer; request missing photos; create quote draft.

**NEXT:** Complete site visit; build line items; internal quote review.

**BLOCKED:**

- Quote **send** blocked: missing customer email  
- Quote **send** blocked: manager approval required  
- Quote **send** blocked: panel photos missing (if template requires)  

**WAITING:** Customer photos; customer availability; estimator site notes.

**NEEDS REVIEW:** Scope ambiguity; low margin; possible permit issue; unsafe panel photo.

This keeps **pre-quote** work **execution-first**: clear **next** and **why blocked**, not a hidden checklist.

---

## Customer View During Intake / Quote

Customer-facing projection ([08-customer-view.md](./08-customer-view.md)) during intake/quote might include **milestones** such as:

- Request received  
- We need more information  
- Site visit scheduled  
- Quote being prepared  
- Quote sent  

**Customer tasks** may include: upload photos; confirm address; confirm availability; answer scope questions; approve quote; sign proposal.

**Internal-only:** Margin review, discount approval, fit/no-fit debates, competitor notes.

---

## No-Quote / Lost Paths

Not every lead becomes a quote. **Opportunity** outcomes should support (examples):

Qualified; disqualified; no response; lost; spam; duplicate; outside service area; not a fit; quote declined by customer; future follow-up.

**Canon:** If **no quote** is created, still preserve lead source, customer info, **reason**, notes, attachments, follow-up date—for **BI** and **future** context if the customer returns.

---

## Handoff Rules

When a **quote** is created from an **opportunity**, **carry forward** (examples):

Customer; contact methods; address; service type; **scope intent**; photos/files; measurements; AHJ/jurisdiction; customer availability; site notes; sales owner; assumptions; selected **quote/workflow template**; preselected **packets**; customer-appropriate proposal notes.

**Do not** carry forward as **sold execution** work:

Internal call attempt tasks; margin review; follow-up email reminders; other **sales-only** tasks—these stay in **opportunity history** or complete on the sales side; they do not become **job runtime** tasks at activation (doc 06).

---

## Worked Example: EV Charger Lead to Quote

1. **Lead in:** Customer wants an EV charger installed (web form or call).  
2. **Opportunity created:** Customer, address, service type EV charger, lead source captured.  
3. **Intake workflow:** Tasks—review lead, call customer, request **panel** photo, request **charger location** photo.  
4. **Customer uploads:** Panel photo + garage wall photo attached as **intake facts**.  
5. **Office review:** Panel looks **full**; possible capacity issue.  
6. **Outcome: Review photos** → “Possible panel capacity issue.”  
7. **New tasks:** Perform load calc / panel review; ask customer if open to panel upgrade if needed; confirm AHJ/permit need.  
8. **Quote draft created:** Primary line item: Install EV charger; **conditional** or allowance line item for panel upgrade / “pending review”; **planned execution** tasks: permit, order materials, install, inspection.  
9. **Readiness:** Draft exists (**create** threshold met); **send** not ready until panel review + margin review (and any other gates) complete.  
10. **Manager approves:** Send gates clear (assuming photos and pricing satisfied).  
11. **Quote sent:** Opportunity stage moves to **Quote Sent / Follow-Up**; execution planning on quote remains **planned** until sold.

---

## Deterministic Rules Examples

Same **facts + template + readiness rules** → same **derived** UI and gates.

| Fact / rule | Derived behavior (example) |
|-------------|----------------------------|
| Missing customer email | **Quote send** blocked: “Customer email required to send this quote.” |
| Required photo missing | **Customer request** task or waiting state; send blocked if template ties send to photo. |
| Service type = EV charger | **Suggested** quote template and packets (suggestion, not random UI). |
| Discount over threshold | **Quote send** blocked: “Manager approval required—discount exceeds configured limit.” |
| Site visit incomplete | **Send** blocked **only if** template requires complete site visit for send; **draft** may still be allowed. |

**Canon:** No guessing; no unexplained “stuck” send—**reasons** are tied to **facts and rules** ([05-deterministic-execution-engine.md](./05-deterministic-execution-engine.md)).

---

## Assumptions

- **Exact** database model and table names are **not** decided here.  
- **OpportunityWorkflowInstance** might share the same **engine** as job workflow with a **different template family**—implementation decision.  
- Some companies may **skip** a formal opportunity record for **fast quote** paths while still logging lead source—product must allow both.  
- **Readiness rules** are **template- and company-configurable**, not one global policy.  
- **Scope intent** might be a first-class object or a structured field on the opportunity—implementation later.

---

## Implementation Later

- Map concepts to **current** lead, customer, opportunity, and quote models in the codebase.  
- Define **minimum viable** `OpportunityWorkflowInstance` (stages, tasks, events).  
- Define **quote readiness** rule DSL or configuration and how it surfaces in UI.  
- Define **scope intent** model and promotion to line items.  
- Define **lead source** tracking and attribution.  
- Define **customer upload** flow (portal vs email vs SMS) and linking to intake facts.  
- Define **AI-suggested line item** behavior: always human-confirm; deterministic **source** tagging ([07-task-dimensions.md](./07-task-dimensions.md)).  
- Define **no-quote / lost** states and reporting.  
- Define **quote from existing customer** UX and data reuse.  
- Define **permissions**: sales vs production vs customer for each task type.  
- Define **events** for opportunity lifecycle (`LEAD_CAPTURED`, `OPPORTUNITY_QUALIFIED`, `QUOTE_DRAFT_CREATED`, `QUOTE_SEND_BLOCKED`, …) for audit and “why blocked” copy.
