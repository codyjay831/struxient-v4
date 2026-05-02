# Open Implementation Questions

This document lists **open questions only**. It does **not** answer them unless the canon text elsewhere already implies a direction—and even then, **implementation must be validated** in engineering review.

Use this list in spikes, schema reviews, and MVP scoping sessions.

---

## Schema and model mapping

- How much of the **current v3/v4 schema** already supports this canon?
- Which existing models map cleanly to **OpportunityWorkflowInstance**, **QuoteWorkflowPlan**, and **JobWorkflowInstance**—and where are the gaps?
- Should **QuoteLocalPacket** (or equivalent) remain the quote-level execution planning primitive, or should it be split/renamed conceptually?
- Should **RuntimeTask** (or current task model) hold **all** task dimensions, or should **related models** own resources, orders, schedule, proofs, and costs?
- Where should **customer-visible milestone projection** live (template, quote, job layer, or separate read model)?
- How should **stage** be represented if today’s UI is column-oriented but canon requires **start/completion conditions** and **overlap rules**?

---

## Events and determinism

- How should **event sourcing** or **event logging** be implemented **without overcomplicating MVP** (append-only log vs state + audit trail)?
- What is the **minimum set of event types** needed for trustworthy “why blocked” explanations?
- How are **idempotent outcome actions** enforced if recalculation runs twice?
- What is the **source of truth** after replay: materialized state, events only, or hybrid?

---

## Engine and work feed

- How should **Work Station** derive **global work across multiple jobs** for managers (query shape, pagination, tenant isolation)?
- What is the **minimum viable version** of **outcome rules** (which action types ship first)?
- How does **preferred order** feed into **“recommended next”** without conflicting with user intuition?
- How are **race conditions** handled when two users complete related tasks simultaneously?

---

## Gates, materials, payments

- How do **payment gates** integrate with **task readiness** and accounting systems?
- How should **material readiness** block execution when inventory integrations are partial or manual?
- Who can **override** a blocker (manager override), and how is that recorded as an **event** without breaking audit?

---

## Change orders and supersession

- How should **change orders** **add** vs **supersede** runtime tasks?
- What is the exact **supersession** semantics for history, billing, and customer-visible milestones?
- How are **partial approvals** (customer approves scope A but not B) represented?

---

## Sales vs sold

- Where does **Opportunity / Sales** workflow live in the data model relative to quotes and jobs?
- What is the **activation** trigger set (signed contract, deposit, manual button, integration event)?
- How is **carry-forward context** stored (attachments, structured fields, links to opportunity tasks)?

---

## Customer and permissions

- What **roles and permissions** gate internal vs customer-visible tasks on shared APIs?
- How much **inspection failure detail** should customers see by default?

---

## Templates, packets, versions

- What is the **versioning** model for templates when jobs save back as **new template / version / packet**?
- How do companies **diff** template changes for review?
- How are **packets** composed and nested without confusing source tracking?

---

## AI and suggestions

- How are **AI suggestions** marked in **source** and prevented from mutating state without human confirmation?
- What events fire when a user **accepts** or **rejects** a suggestion?

---

## Scale and UX

- Which **advanced fields** should be exposed first in progressive UI vs hidden until template “expert mode”?
- What are the **performance budgets** for recalculation on large jobs (hundreds of tasks)?
- How does the **simple default** screen stay uncluttered while the **advanced model** stays complete?

---

## Assumptions (not canon)

- This list will grow during the first architecture review; it is not claimed to be complete.

---

## Implementation later

- Turn prioritized subsets of these questions into ADRs (Architecture Decision Records) after decisions are made—outside the scope of this planning-only pass.
