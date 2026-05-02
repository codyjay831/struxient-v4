# Work Station Surface

## Purpose (canon)

**Work Station** is **not** “just another page.” It is the **primary execution and decision hub** for internal Struxient use: the place that answers **“what now?”** in line with the [execution-workflow](../execution-workflow/09-work-station-what-now.md) canon.

**Canon:**

- **Default landing surface** for most internal users after login (exact routing may vary by role—see [03](./03-role-based-navigation-and-visibility.md), [04](./04-login-auth-and-portal-model.md)).  
- **Role-aware** — same underlying work, different **filters, priorities, and explanations**.  
- **Execution-first** — emphasizes **actionable** work over passive charts.  
- Supports **both sales and production** through **filtered views** and feed categories, without duplicating entire **Sales** or **Jobs** modules inside Work Station.  
- A **command center**, not a generic vanity dashboard: every prominent block should tie to **doing**, **deciding**, or **unblocking** something.

---

## Why Work Station is the default home

Construction operations rarely start with “open the org chart.” They start with:

- What is **due**?  
- What is **blocked** and **why**?  
- Who is **waiting** on whom?  
- What needs a **manager decision**?

Work Station is where those questions are **answered first**, with **drill-down** into **Jobs**, **Sales**, **Customers**, or **Finance** as needed. Deep record-keeping stays in those areas; **orchestration of attention** stays here.

---

## Likely tabs / sub-surfaces (planning)

These are **conceptual groupings** for information architecture—not a mandate for tab names or that all ship at once.

| Tab / sub-surface | What it is for |
|-------------------|----------------|
| **Overview** | Role-tuned summary: critical counts, today’s priorities, **at-a-glance** health—not replacing the full feeds. |
| **Schedule** | Time-based lens: what is booked, what is at risk, conflicts; ties schedule **facts** to task readiness (execution docs). |
| **Requests** | Inbound work: customer uploads, approval requests, partner asks, internal handoffs that need a human. |
| **All Projects** | Cross-job lens: active jobs/opportunities list with **status** and **next bottleneck** columns (product-defined). |
| **Task Feed** | The canonical **work feed** with categories Now / Next / Blocked / Waiting / Needs Review / Scheduled / Done. |
| **Crews & Employees** | Who is assigned where, capacity, **field-relevant** roster view for leads/managers (permission-gated). |
| **Analytics** | Read-only trends: blocked reasons, cycle time, win rate hooks—**secondary** to action; does not replace BI tools if integrated later. |

**Canon:** Tabs keep the **left nav stable**; depth lives **inside** Work Station.

---

## Core work feed categories

Aligned with [execution-workflow 09](../execution-workflow/09-work-station-what-now.md):

| Category | Plain meaning |
|----------|----------------|
| **Now** | Ready to act **immediately** (start or finish). |
| **Next** | Likely soon; soft priority when “Now” is clear. |
| **Blocked** | Cannot proceed until **specific** facts change—with **reasons** and **suggested fixes**. |
| **Waiting** | External or customer/AHJ/supplier hold. |
| **Needs Review** | Human judgment: margin, scope, safety photo, change order. |
| **Scheduled** | On the calendar; may still flip to Blocked if facts change. |
| **Done** | Completed for the chosen time window (still explorable for audit). |

**Bad blocked copy:** “Permit blocked.”  
**Good blocked copy:** “Permit task blocked: AHJ not confirmed; open Confirm AHJ on Smith opportunity.” (Deterministic explanations—execution canon.)

---

## Context rail (right-side support)

Work Station should support a **context rail** (or equivalent panel): **secondary** to the main feed, **read-only or lightly interactive**, always **safe** for the role viewing it.

**May include (canon examples):**

- **Customer messages** — thread or last message preview with link to full comms.  
- **Safe navigation / quick actions** — “Open job,” “Call customer” (tel link), “Add note” without derailing the feed.  
- **Recommended next** — one or a few engine-suggested actions with **why** (ties to deterministic engine).  
- **Contextual shortcuts** — links to related quote, permit doc, customer record.  
- **Alerts** — SLA, inspection tomorrow, payment due (product-defined).  
- **Read-only widgets** — weather at job site, AHJ name, job value (if allowed).

**Does not replace:** Full **Jobs** page, full **Customers** CRM, or **Finance** ledger—those remain **primary surfaces** for deep work.

---

## Role-based variants

Same **shell**, different **defaults and filters**.

### Manager

Emphasis: **cross-job risk**, blockers, approvals, crew utilization highlights. Overview + Task Feed + All Projects weighted heavily.

### Office / operations

Emphasis: permits, scheduling, material blockers, customer comms, coordinating crews. Schedule + Requests + Task Feed.

### Sales / estimator

Emphasis: follow-ups, quote send blockers, customer photo requests, opportunities needing touch. Task Feed + Requests; **Sales** nav for deep quote editing (canon: Work Station still shows **sales “what now”**—see open questions for default landing).

### Field worker / crew lead

Emphasis: **today’s** tasks, **my crew**, upload proof, simple blocked reasons. Task Feed + Schedule; **reduced nav** possible (see doc 03). Field lead may see **Crews & Employees** for their team.

**Principle:** Work Station **adapts** with role presets; it does **not** require a separate “Field app IA” philosophy unless mobile constraints demand it—**canon** is one system, **filtered** surfaces.

---

## How Work Station supports execution-first operation

1. **Surfaces derived work** from the same facts/rules as Jobs (see [execution-workflow 05](../execution-workflow/05-deterministic-execution-engine.md)).  
2. **Explains** blockers in **contractor language** with **next fix**.  
3. **Routes** users to the **owning surface** when depth is needed (open full job, open quote, open invoice context).  
4. Keeps **attention** on **closing loops**, not browsing.

---

## Assumptions (not canon)

- Whether **Overview** and **Task Feed** merge in early versions is a product decision.  
- “Context rail” might be **drawer**, **slide-over**, or **bottom sheet** on small screens.

---

## Implementation later

- Real-time updates vs pull-to-refresh.  
- Per-user layout save (which tabs pinned).  
- Offline field subset (if ever).
