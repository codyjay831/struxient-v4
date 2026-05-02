# Struxient v4 Finance and Payment Gates

## Purpose

Define **money-related canon** for Struxient v4: how **pricing** on quotes relates to **deposits**, **payment gates**, and **blocked execution**—without mandating that Struxient replace full **accounting** software unless the product later decides so.

**CANON:** **Payment gate** = rule/fact that **blocks or warns** execution until a **payment condition** is satisfied ([03](../execution-workflow/03-quote-to-execution-model.md), [13](../execution-workflow/13-calendar-and-scheduling-model.md)).  
**ASSUMPTION:** General ledger sync is **implementation later**.

---

## Scope in product (conceptual)

| In scope (typical) | Later / optional |
|--------------------|------------------|
| Quote totals, line prices, discounts, tax display | Full GL |
| Deposits, progress milestones, **gates** | Complex multi-entity billing |
| Invoice **status** / payment recorded | Automated dunning enterprise-wide |
| **Margin** internal-only surfaces | Tax engine for all jurisdictions |

---

## Payment gate (definition)

A **structured** condition tied to quote/job/task readiness, e.g.:

- **Deposit required** before permit submission.  
- **Progress payment** before install start.  
- **Final payment** before closeout packet / warranty release.

**Effects:** Block or warn **task scheduling**, **task start**, or **stage advance** per template ([05](../execution-workflow/05-deterministic-execution-engine.md)).

---

## Examples (canon)

- Permit task **blocked** until deposit recorded.  
- Install **scheduled but blocked** on calendar if gate later fails ([13](../execution-workflow/13-calendar-and-scheduling-model.md)).  
- Customer sees **amount due** and **terms**; not margin.

---

## Finance facts in Work Station / Jobs

**Blocked** cards show **payment** reason when gate is the blocker ([work-station MVP](../work-station/struxient-v4-work-station-mvp.md)).

---

## Roles and sensitivity

| Data | Typical visibility |
|------|-------------------|
| Margin | Owner/manager/finance; not field |
| Customer price | Customer + sales |
| Supplier cost | Internal |
| Payment received | Office/finance |

---

## Customer-visible payment requirements

Customer portal may show **due amounts** and **how to pay** (implementation later); never internal margin.

---

## Accounting integration

**Implementation later:** QuickBooks/Xero/etc.; export events; idempotent sync.

---

## Open questions

- Partial payments?  
- Retainage for commercial GC workflows?

---

*Planning canon only.*
