# Left Navigation Model

## Purpose of the left nav (canon)

The **left navigation** is the **primary internal navigation spine** for Struxient. It should stay **stable** and **low cognitive load**: a small set of **major areas**, each with a clear job. **Tabs and secondary navigation** belong **inside** those areas—not as an ever-growing list of top-level items.

**Canon principles:**

- **Stable spine** — Users build muscle memory; the shell does not reshuffle casually.  
- **Not overloaded** — One-off features and deep detail live **inside** a parent surface.  
- **Ownership clear** — Each top-level item **owns** some questions and explicitly **does not** own others (to avoid duplicate “homes” for the same work).

This document uses **canonical** nav labels for planning. **Actual** labels in the product may differ until reviewed.

---

## Canonical internal left nav items

| Item | One-line purpose |
|------|------------------|
| **Work Station** | Role-aware **“what now?”** command center; default internal home for most users. |
| **FlowSpec Builder** | Author **reusable** workflows: stages, tasks, outcomes, routing logic, templates. |
| **Jobs** | **Sold** live and historical work: job record, workflow instance, runtime tasks, change orders, corrections, milestones, closeout. |
| **Customers** | **CRM-style** customer record: contacts, notes, comms context, profile; links to opportunities, quotes, jobs. |
| **Sales** | **Pre-send**: lead intake, opportunities, quote build/send/follow-up **before** sale. |
| **Finance** | Money side: payments, gates, invoices, collections visibility, financial status; **margin/pricing review** may live here or partly in Sales/Admin depending on product scope. |
| **Admin** | **Company-level**: users, permissions, company config, workflow governance, integrations, global defaults. |
| **Catalog** | **Reusable building blocks**: line item templates, packets, service offerings, reusable execution bundles; **may** include material/equipment assemblies (open question). |
| **Settings** | **User-level** preferences; **may** surface company settings **entry** for privileged users, but **governed** company config **belongs** under Admin in canon. |

Below: each item in detail.

---

## Work Station

**Purpose:** The **default internal home** and **execution-first** hub. Answers **what should happen now**, **who should do it**, **what is blocked**, and **what needs a decision**—across **sales and production** via **filters**, not duplicate modules.

**Owns:**

- Aggregated **work feed** (Now, Next, Blocked, Waiting, Needs Review, Scheduled, Done).  
- **Role-aware** landing experience and shortcuts into the right record (job, quote, customer).  
- **Cross-cutting “today”** questions that do not belong exclusively to one job page.

**Does not own:**

- Deep **authoring** of company-wide workflow templates (that is **FlowSpec Builder**).  
- **Authoritative long-term storage** of the full customer CRM narrative (that is **Customers**—Work Station **surfaces** work **about** customers).  
- **Full quote editor** as the only place quotes exist (deep quote work may live under **Sales**; Work Station **links** into it).

**Users:** Most internal roles daily—managers, office, sales, crew leads; field workers in a **field-focused** variant.

**Example actions:** Open next blocked install; approve a change order from a queue; call customer about access; jump to permit task on a job.

**Connects to:** **Jobs** (task deep links), **Sales** (quote/opportunity follow-ups), **Customers** (context), **Finance** (payment-gate blockers surfaced as facts), **Catalog** (rarely direct; usually via quote/job).

---

## FlowSpec Builder

**Purpose:** **Design** reusable **process logic**—workflow templates, stage flows, task definitions, outcome rules, assignment/routing defaults—so runtimes (quotes/jobs) **copy** plans instead of mutating live blueprints (aligned with [execution-workflow](../execution-workflow/01-canon-summary.md) template canon).

**Owns:**

- Template and **FlowSpec** authoring (naming is conceptual).  
- Stage/task/outcome **configuration** at the **blueprint** level.  
- Governance: who may publish templates, versioning intent (see execution docs).

**Does not own:**

- **Running** a specific job’s tasks (that is **Jobs** + engine + events).  
- **Pricing** commercial line items (often **Sales** + **Catalog**).  
- **Day-to-day** “my tasks today” (that is **Work Station**).

**Users:** Admins, operations leads, power estimators who maintain company standards.

**Example actions:** Add “Inspection failed → correction tasks” outcome rule; publish “EV charger” workflow template; adjust stage overlap rules.

**Connects to:** **Catalog** (packets/items referenced by templates); **Jobs** (instances created from published specs); **Admin** (permissions, environments).

---

## Jobs

**Purpose:** **Sold execution** home: one place for **active and historical jobs**—workflow instance, runtime tasks, change orders, corrections, milestones, closeout.

**Owns:**

- Job **record** and **timeline** of sold work.  
- **Runtime** task boards/detail scoped **to that job** (when users choose “inside this job”).  
- Job-level artifacts: photos, inspections, COs, as product defines.

**Does not own:**

- **Pre-send** opportunity pipeline (that is **Sales**).  
- **Company-wide** template authoring (FlowSpec Builder).  
- **Global** “all my tasks across all jobs” as the only UI—that is canonically **Work Station** territory.

**Users:** Office, managers, crew leads, field (with permission limits).

**Example actions:** Open Smith job; complete install task; apply change order; view inspection failure history.

**Connects to:** **Customers** (job’s customer); **Finance** (invoice/payment status); **Work Station** (aggregated alerts feed same underlying tasks).

---

## Customers

**Purpose:** **Customer relationship** record and history—not only “the person on this job.”

**Owns:**

- Contact info, notes, communication context, attachments that belong to the **relationship**.  
- Links to **opportunities**, **quotes**, **jobs** for that customer.  
- Profile fields the company uses for CRM hygiene.

**Does not own:**

- **Authoritative** execution of tasks (Jobs / Work Station).  
- **Template authoring** (FlowSpec Builder / Catalog).

**Users:** Sales, office, managers.

**Example actions:** Log a call; attach HOA letter; see all past quotes and jobs for this address.

**Connects to:** **Sales**, **Jobs**, **Work Station** (customer name appears in feeds).

---

## Sales

**Purpose:** **Pre-send** pipeline: lead intake, opportunities, **quote creation**, follow-up, quote sent—**before** activation to a job (see [execution-workflow 06](../execution-workflow/06-sales-vs-sold-execution.md), [11](../execution-workflow/11-lead-intake-to-quote-creation.md)).

**Owns:**

- Opportunity and **quote draft** work surfaces.  
- **Quote readiness** and send workflow from the **sales** side.  
- Sales tasks that **do not** auto-become sold execution tasks.

**Does not own:**

- **Post-sold** install/inspection **runtime** as the primary framing (that is **Jobs** + Work Station).  
- **Chart of accounts** or full accounting (Finance).

**Users:** Sales, estimators, often managers for approvals.

**Example actions:** Create quote from opportunity; request customer photos; send proposal; mark lost.

**Connects to:** **Customers**; **Catalog** (line items/packets); **Jobs** (when sold); **Finance** (deposit/pricing hooks); **Work Station** (sales user still sees “what now” here or in Work Station per config).

---

## Finance

**Purpose:** **Money and financial visibility** tied to work: payments, **payment gates**, invoices, collections, pricing/margin **where product scope places them**.

**Owns:**

- Payment status, invoice list/context, gate satisfaction facts that **block** work (surfaced also in Work Station).  
- Financial **review** queues if product includes them.

**Does not own:**

- **Task execution** itself (Jobs/Work Station).  
- **Workflow template** authoring.

**Users:** Office, finance role, owners; managers read-only or limited per permissions.

**Example actions:** Record payment received; see jobs blocked by deposit; export invoice context.

**Connects to:** **Jobs** and **Sales** (quote/job monetary context); **Work Station** (blocked-by-payment explanations).

---

## Admin

**Purpose:** **Company-level** control: who works here, what they can see, how the company runs in Struxient.

**Owns:**

- Users, **roles**, permissions.  
- Company configuration, integrations, **global defaults**.  
- **Workflow governance** (who publishes templates, audit hooks as product defines).

**Does not own:**

- **Individual user** theme/notification prefs (Settings)—except where Admin mandates policy.

**Users:** Owner, admin, sometimes delegated “ops admin.”

**Example actions:** Invite user; disable integration; set default quote template policy.

**Connects to:** Everything; touches **FlowSpec Builder**, **Catalog**, **Finance** configuration.

---

## Catalog

**Purpose:** **Reusable** commercial and execution **building blocks** the company reuses across quotes and templates.

**Owns:**

- Line item templates, **packets**, service offerings, reusable **execution bundles** (as product defines).  
- Optional: assemblies for materials/equipment (see open questions).

**Does not own:**

- **Running** a specific job.  
- **Full** CRM (Customers).

**Users:** Estimators, ops, admins maintaining standards.

**Example actions:** Edit “EV charger install” packet; add standard line item with default tasks.

**Connects to:** **Sales** (quote building), **FlowSpec Builder** (templates reference catalog items).

---

## Settings

**Purpose:** **Personal** and **lightweight** preferences: notifications, display, defaults **for me**.

**Owns:**

- User profile basics, personal prefs.  
- **Optional** deep link or subsection to **company** settings **for users with rights**—but canon: **governed** company configuration **lives under Admin** conceptually.

**Does not own:**

- **Authoritative** permission matrix (Admin).  
- **Publishing** workflow templates (FlowSpec Builder + Admin policy).

**Users:** All internal users.

**Example actions:** Change timezone; toggle email summaries.

**Connects to:** **Admin** when user has elevated access.

---

## Secondary navigation vs left nav (canon)

| Belongs on **left nav** | Belongs **inside** a major surface |
|-------------------------|-----------------------------------|
| Stable “chapters” of the product | Job tabs, quote steps, template editors |
| Areas every role recognizes | Wizards, filters, one-off reports |
| ~9 canonical items (this doc) | Feature-specific sub-routes |

**Canon:** If a new feature does not deserve its own **ongoing** “chapter,” it ships **inside** Work Station, Jobs, Sales, or Admin—not as a tenth sibling unless IA is intentionally revised.

---

## Assumptions (not canon)

- Exact **order** of nav items (e.g., Finance before Sales) is UX polish.  
- Some companies might **hide** nav items by feature flag; canon still lists the **conceptual** areas.  
- “FlowSpec Builder” is a **planning name**; product UI might say “Workflows” or “Templates.”

---

## Implementation later

- Badges (counts) on nav items and rules for when they appear.  
- Mobile: collapsed nav, bottom bar, or role-reduced shell (see [06-open-app-shell-questions.md](./06-open-app-shell-questions.md)).
