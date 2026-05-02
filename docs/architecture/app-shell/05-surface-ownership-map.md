# Surface Ownership Map

## Purpose

Answer **“Where do I go for X?”** by mapping **major product concerns** to their **primary owning surface**, with **cross-links** between areas. This complements [01-left-navigation-model.md](./01-left-navigation-model.md) with a **question-first** view.

---

## User questions → primary surface

| User question | Primary surface | Notes |
|---------------|-----------------|--------|
| What should I do **now** (across jobs/quotes)? | **Work Station** | Aggregated feed; drill-down elsewhere. |
| What is on my **calendar** this week? | **Work Station** → Schedule (or Jobs calendar if product places it there) | Canon favors Work Station **lens**; deep per-job calendar may live on **Job**. |
| Design **reusable** workflow logic (stages, outcomes)? | **FlowSpec Builder** | Templates; not runtime mutation of live jobs. |
| See **active sold** work and **runtime** tasks for one job? | **Jobs** | Authoritative **per-job** home. |
| Manage **customer relationship** and history? | **Customers** | CRM-style record. |
| Work a **lead**, opportunity, **quote** before sale? | **Sales** | Pipeline + quote draft/send. |
| Check **payment**, invoice, **payment gate** context? | **Finance** | Gates also **surface** as facts in Work Station / Jobs. |
| Add users, **roles**, company **integrations**? | **Admin** | Governance. |
| Reuse **line items**, **packets**, service bundles? | **Catalog** | Feeds **Sales** and **FlowSpec Builder**. |
| Change **my** notification prefs or profile? | **Settings** | Personal; company policy in **Admin**. |

---

## Major concerns by owning surface (expanded)

### Work Station owns

- **Attention orchestration:** Now, Next, Blocked, Waiting, Needs Review, Scheduled, Done.  
- **Cross-job** and **cross-quote** “what now” for the logged-in user or their teams.  
- **Role-tuned** home and **context rail** shortcuts ([02](./02-work-station-surface.md)).

### Work Station does not own (alone)

- **Publishing** workflow templates.  
- **Authoritative** financial ledger.  
- **Full** CRM record editing as the only place (Customers shares ownership).

---

### FlowSpec Builder owns

- **Blueprint** authoring: stages, tasks, dependencies, outcome rules, routing.  
- **Versioning / governance** concepts (with Admin).

### FlowSpec Builder does not own

- **Day-to-day** completion of a specific install task (Jobs + engine).

---

### Jobs owns

- **Sold** job record, workflow **instance**, runtime tasks, corrections, change orders, closeout artifacts.  
- **Per-job** narrative and documents.

### Jobs does not own

- **Pre-send** opportunity pipeline (Sales).  
- **Company-wide** template source of truth (FlowSpec Builder).

---

### Customers owns

- Contact graph, notes, comms context, **relationship** view.  
- Links to opportunities, quotes, jobs.

### Customers does not own

- **Execution** of tasks (Jobs / Work Station).

---

### Sales owns

- Lead → opportunity → **quote** lifecycle **before** activation.  
- **Quote readiness** and send from the **sales** workspace.

### Sales does not own

- **Post-sold** execution as the **primary** framing (Jobs)—though sales may **view** for follow-up.

---

### Finance owns

- Payments, invoices, collections **surfaces**, **payment gate** configuration linkage.  
- Margin/financial **review** queues if in scope.

### Finance does not own

- **Task board** semantics (Jobs/engine)—but **readiness** reads **gate facts**.

---

### Admin owns

- Users, roles, permissions, company config, integrations.

### Admin does not own

- **Individual** user theme prefs (Settings)—except enforced policies.

---

### Catalog owns

- Reusable commercial and execution **building blocks**.

### Catalog does not own

- **Running** job state.

---

### Settings owns

- **User-level** preferences and profile basics.

### Settings does not own

- **Permission matrix** (Admin).

---

## How surfaces relate (cross-links)

```text
Sales ──creates quotes──► Jobs (when sold)
   │                           ▲
   │                           │
   └── uses Catalog ◄──────────┼── FlowSpec Builder uses Catalog
              │                │
              ▼                │
        FlowSpec Builder ──────┘ influences workflow instances on Jobs

Customers ◄── links ──► Sales, Jobs

Finance ◄── payment gates / invoices ──► Jobs, Sales (deposits, quote money)

Work Station ──surfaces work from──► Sales, Jobs, Requests, Finance facts
```

**Narrative:**

- **Sales** creates quotes; **sold** activation creates or unlocks **Jobs**.  
- **Catalog** feeds **Sales** (line items/packets) and **FlowSpec Builder** (template building blocks).  
- **FlowSpec Builder** shapes what **Jobs** instances look like when applied.  
- **Customers** ties **Sales** and **Jobs** to the same **person/organization**.  
- **Finance** influences **readiness** via **payment gates** (execution canon).  
- **Work Station** **aggregates** actionable items from **Sales**, **Jobs**, and **requests**—it is not the sole owner of underlying records.

---

## Work Station interaction with the rest

| From Work Station | User might open |
|-------------------|-----------------|
| Blocked install | **Jobs** → install task |
| Quote send blocked | **Sales** → quote |
| Customer thread | **Customers** or embedded comms |
| Payment blocker | **Finance** or job billing panel |

**Canon:** Work Station is the **front door**; other nav items are **rooms** with specialized tools.

---

## Assumptions (not canon)

- Some **concerns** may be **embedded** tabs inside Jobs (e.g., small invoice widget)—ownership is still **Finance** for money truth.  
- Exact **URL** structure is implementation.

---

## Implementation later

- Deep linking from notifications into correct tab with context.  
- Cross-surface **breadcrumbs** standard.
