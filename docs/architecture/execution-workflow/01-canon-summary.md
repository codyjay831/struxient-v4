# Canon Summary

This document states the **locked product direction** for Struxient’s execution workflow architecture. It separates **canon** (intended model) from **implementation** (what exists in code today). Unless a sentence explicitly says “current codebase,” treat content as **target behavior**.

---

## Locked direction (narrative)

Struxient should be an **execution-first construction workflow system**. The product’s center is a small set of questions people actually ask on the job:

- **What now?**
- **What should happen next?**
- **Who should do it?**
- **Why is it ready?**
- **What is blocked?**
- **What happens if this goes wrong?**

The **quote** and **workflow builder** create the **plan**. The **active job experience** runs the **plan** and surfaces **derived** next steps—not a separate “truth” invented by the UI.

The system supports **deterministic workflow** while staying flexible for real construction:

- **Deterministic** means: given the same workflow instance state, task statuses, dependencies, gates, assignments, schedule facts, materials, customer availability, and outcome events, the engine always derives the same **ready work**, **blocked work**, **next recommended work**, **stage state**, and **required follow-up actions**.
- **Deterministic does not mean rigid.** It means **repeatable derivation from facts and rules**, not creative guessing during execution.

**Workflow templates** are reusable blueprints. They must **not** be mutated by job execution. When a template is chosen for a quote or job, it is **copied** into a local instance; changes belong to that quote/job unless the user explicitly saves a **new template, version, or packet**.

There is a real split between **pre-send / sales** work and **sold execution** work, connected by the **quote**. Sales task outputs become **execution context**; **sold scope** drives **execution tasks**—not a 1:1 copy of every sales task into the job board.

**Tasks** are the central operational object. **Stages** organize timing and structure. **Outcomes** (pass, fail, reschedule, scope issue, etc.) trigger **safe, structured actions**. **Events** record what happened so the app can explain **why** something is blocked or exists.

The **customer view** is a **filtered projection** of the same workflow truth—not a disconnected second workflow.

**Simple and advanced** share one powerful model: the **data model is advanced-capable from the start**; the **UI progressively reveals** complexity. The canon rejects “build a basic task list first and bolt workflow on later.”

---

## Canon statements

Short bullets the team can use in reviews and PR discussions:

- **Execution-first**: primary value is clarity on what to do now, who owns it, and why—derived from rules and facts.
- **Quote = commercial + operational blueprint** (not “just pricing”).
- **Templates = blueprints, not live execution truth**; copy on use; no silent template mutation from jobs.
- **Quote/job instances** are locally customizable; promotion back to template/version/packet is explicit.
- **Sales workflow** and **sold job execution workflow** are **separate**; the **quote bridges** them.
- **Sales tasks do not automatically become execution tasks**; **sales outputs** can **carry forward as context** for execution.
- **Line items own commercial scope**; **tasks own execution detail**; **stages organize when and where** work sits in the pipeline.
- **Preferred order ≠ hard dependency**; both are first-class so the system can be helpful without being annoying.
- **Stages advance on conditions**, not primarily on “someone clicked next stage.”
- **Tasks complete with optional outcomes**; outcomes drive **deterministic action lists** (create task, block stage, notify, etc.).
- **Structured events** back every meaningful change; current state is **derived** from initial copy + quote/job deltas + events.
- **Deterministic engine**: same facts + rules → same derived work feed and explanations.
- **Work Station / work feed** answers “what now” for **role-aware** users without reading the full graph.
- **Customer view** = same underlying model, **visibility and milestone mapping**.
- **One architecture**; **progressive UI** for simple vs power users.
- **Reuse levels:** (1) **Save as Template** — company-wide reusable workflow; (2) **Save as Packet** — reusable chunk of tasks (e.g., “EV charger install” sub-flow); (3) **Save job changes back** as new template version or packet — **never** silently overwrite the original template; UI offers **new template / new version / packet / discard**.

---

## Assumptions (not canon)

The following are **planning assumptions** until validated against product and codebase review:

- A single conceptual **execution engine** can serve office, field, and customer-facing surfaces with different filters.
- Event volume and query patterns can be handled with a pragmatic (not necessarily full event-sourcing) approach for early versions.

These are **not** stated as already implemented.

---

## Implementation later

- Map canon entities to existing database models and APIs.
- Define minimal event types and idempotency rules for recalculation.
- Define versioning and “save back as template” UX and data rules in detail.
