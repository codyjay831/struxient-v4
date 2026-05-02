# Struxient v4 Work Station MVP

## Purpose

Define the **first useful** internal **Work Station** so engineering can implement later without re-litigating basics. Aligns with [09-work-station-what-now](../execution-workflow/09-work-station-what-now.md), [13-calendar](../execution-workflow/13-calendar-and-scheduling-model.md), and [app-shell 02](../app-shell/02-work-station-surface.md).

**CANON:** Work Station is **execution-first**, **role-aware**, and **not** a vanity dashboard.  
**ASSUMPTION:** MVP uses **deterministic rules + priority sort**, not ML recommendations.

---

## Why Work Station exists

Users should not open **every job** to find the next action. Work Station **aggregates** actionable items and **explains blockers**, with **deep links** into **Sales**, **Jobs**, **Customers**, **Finance** context.

---

## MVP user roles

| Role | MVP emphasis |
|------|----------------|
| **Manager** | Cross-job blockers, approvals, at-risk schedule |
| **Office / ops** | Permits, materials, scheduling, customer follow-ups |
| **Sales** | Quote send blockers, customer uploads, follow-ups |
| **Field / crew lead** | Today’s tasks, simple blocked reasons, next stop |

---

## MVP feed categories

- **Now** — Ready to act immediately.  
- **Blocked** — Cannot proceed; **must** show reason MVP (string or structured v1).  
- **Waiting** — External/customer/supplier/AHJ.  
- **Needs Review** — Margin, safety, scope, approval queues.  
- **Scheduled / Today** — Booked work for the day (ties to [13](../execution-workflow/13-calendar-and-scheduling-model.md)).  
- **Done recently** — Optional; last N completed for confidence/audit.

**Out of MVP:** Full “Next” sophistication; global analytics tab.

---

## Card types (MVP)

Each card type should show: **title**; **type**; **customer/job/quote**; **owner/assignee**; **status**; **why now / why blocked**; **primary action**; **deep link**.

| Type | Use |
|------|-----|
| **Quote task card** | Quote-prep: missing email, margin review, send blocked. |
| **Job task card** | Runtime task ready/blocked. |
| **Customer request card** | Upload photo, confirm availability. |
| **Schedule card** | Today’s install; at-risk slot. |
| **Payment blocker card** | Gate unsatisfied blocking task/stage. |
| **Review / approval card** | Manager approve quote/discount. |

---

## Data sources (conceptual)

- **Tasks** (quote-prep + runtime) with status and readiness facts.  
- **Schedule** facts (start/end, crew).  
- **Payment gate** facts.  
- **Requests** from customer portal (if MVP 5 exists).  
- **Minimal events** for “what changed” optional in MVP 3.

---

## Ranking / prioritization

MVP: **rule-based** ordering—e.g., blocked customer payment on **today’s** install before generic follow-up. Document sort keys in implementation; no AI required.

---

## Blocked explanations

Must be **specific** ([09](../execution-workflow/09-work-station-what-now.md)): e.g., *Send blocked: customer email missing—open Customer + Job Context.*

---

## Context rail MVP

Read-only or light actions: last **message** preview (if available); **Open job** / **Open quote**; **Recommended next** one-liner from rules; small **alerts** (inspection tomorrow). **Not MVP:** full chat UI.

---

## Deep links

Every card opens the **correct** surface + section: quote workspace readiness panel; job task drawer; customer record; finance panel stub.

---

## What not to build yet

- Full **graph** visualization of workflow.  
- **AI** “best next” without explainable rules.  
- **Cross-tenant** manager views.  
- Heavy **real-time** collaboration.

---

## Open questions

- Single feed with **tabs** vs separate pages per category?  
- Pagination vs infinite scroll for 500+ tasks?

---

## Implementation later

- Structured blocker objects for i18n.  
- WebSocket or poll for live updates.  
- Badge counts on app-shell nav ([app-shell 06](../app-shell/06-open-app-shell-questions.md)).

---

*Planning spec only.*
