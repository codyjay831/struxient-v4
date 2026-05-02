# Struxient v4 Change Orders and Revisions

## Purpose

Define how **quotes** and **jobs** change **safely**: revisions before/after send, **change orders** after sold, **supersession**, and **events**—aligned with [04-outcomes](../execution-workflow/04-stages-tasks-outcomes.md), [06-sales-vs-sold](../execution-workflow/06-sales-vs-sold-execution.md), [12-quote-authoring](../execution-workflow/12-quote-authoring-ux-and-readiness.md).

**CANON:** **Never silently overwrite history.** Changes create **events**. Sold work changes through **controlled** CO/revision flows. Runtime tasks may be **added**, **superseded**, or **canceled** with **explanation**.

---

## Terms

| Term | Meaning |
|------|---------|
| **Revision** | New **quote version** before or after send; may reset readiness. |
| **Change order** | Post-sold **contractual** change to scope/price with approval trail. |
| **Supersession** | New task/version **replaces** prior for forward work; prior kept in history. |
| **Additive change** | Adds line items or tasks without removing old. |
| **Replacement change** | Substitutes scope; may supersede old tasks. |
| **Canceled work** | Explicitly removed from active plan with reason. |
| **Customer-approved delta** | Customer accepts price/scope change (portal or sign). |

---

## Quote revision before send

Internal edits: line items, prices, assumptions—version bump; activity log ([12](../execution-workflow/12-quote-authoring-ux-and-readiness.md)).

---

## Quote revision after sent

May require **customer notification**, new version, **re-accept** flow—policy/legal dependent.

---

## Customer-requested vs internal revision

- **Customer-requested** — e.g., move charger location; may create quote-prep tasks.  
- **Internal** — fix typo, fix margin error; still event-backed.

---

## Change order after sold

- **Create CO** artifact (id, reason, author).  
- **Pricing delta** on line items or new lines.  
- **Execution impact:** add/supersede/skip tasks; block until approved if required.  
- **Customer approval** when policy requires ([customer-portal](../customer-portal/struxient-v4-customer-portal-mvp.md)).

---

## Examples

- **Before sign:** customer changes charger location → revise quote line + planned conduit tasks.  
- **After sold:** extra conduit in field → CO + internal review + customer approve + new tasks.  
- **Inspection fail** → correction tasks (outcome path) may or may not use formal CO depending on template.  
- **Panel upgrade add-on** → additive line + tasks.  
- **Decline optional add-on** → remove optional line; event log.

---

## Event history (examples)

`CHANGE_ORDER_CREATED`; `CHANGE_ORDER_APPLIED`; `QUOTE_REVISED`; `TASK_SUPERSEDED`; `TASK_CANCELED`.

---

## Open questions

- CO vs **informal** field note for small T&M?  
- Link CO to accounting invoice line items?

---

## Implementation later

- CO PDF generation; e-sign on delta.

---

*Planning canon only.*
