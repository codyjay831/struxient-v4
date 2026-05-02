# Struxient v4 Permissions Matrix (Canon)

## Purpose

Define **action-level permission canon** for Struxient v4: who may do what, how **customer** and **future partner** scopes differ from internal staff, and why **hiding nav** is not security.

**CANON:** Every **mutating** and sensitive **read** action checks **permission** server-side. **Customer portal** is **scoped** and **filtered**. **Overrides** are **audited** ([execution-workflow](../execution-workflow/05-deterministic-execution-engine.md) event spirit).

**ASSUMPTION:** Exact role names in RBAC tables TBD when code exists.

---

## Principles

1. **Tenant isolation** — no cross-company data by ID guessing.  
2. **Nav visibility ≠ authorization** — deep links must **403** if unauthorized ([app-shell 03](../app-shell/03-role-based-navigation-and-visibility.md)).  
3. **Sensitive fields** — margin, internal risk, supplier cost restricted.  
4. **Overrides** — manager unblock schedule/material with **who/when/why** logged.  
5. **Customer** — token or account scoped to **project/quote** slice only.

---

## Roles (conceptual)

Owner/Admin; Manager; Office/Ops; Sales/Estimator; Crew Lead; Field Worker; Customer; Partner/Vendor (future).

---

## Action matrix (planning defaults)

Legend: **Y** allowed, **N** denied, **L** limited/read-only, **C** company policy.

| Action | Owner/Admin | Manager | Office | Sales | Crew Lead | Field | Customer |
|--------|-------------|---------|--------|-------|-----------|-------|----------|
| View customer | Y | Y | Y | Y | L | L | N* |
| Edit customer | Y | Y | Y | Y | N | N | N |
| Create opportunity | Y | Y | Y | Y | N | N | N |
| Create quote | Y | Y | L | Y | N | N | N |
| Edit quote | Y | Y | L | Y | N | N | N |
| Send quote | Y | Y | L | Y | N | N | N |
| Internal approve quote | Y | Y | C | C | N | N | N |
| See margin | Y | Y | C | C | N | N | N |
| Create / activate job | Y | Y | Y | L | N | N | N |
| Complete task | Y | Y | Y | L | Y | Y | L** |
| Reopen task | Y | Y | Y | N | L | N | N |
| Override blocker | Y | Y | C | N | N | N | N |
| Change schedule | Y | Y | Y | L | L | L | C |
| View finance detail | Y | Y | Y | L | N | N | N |
| Record payment | Y | Y | Y | N | N | N | N |
| Manage catalog | Y | Y | L | L | N | N | N |
| Publish FlowSpec | Y | Y | N | N | N | N | N |
| Manage users / Admin | Y | L | N | N | N | N | N |
| Customer portal access | N | N | N | N | N | N | Y (scoped) |
| Upload as customer | N | N | N | N | N | N | Y |
| Approve change order (customer) | N | N | N | N | N | N | Y |

\* Customer may see **self** profile slice only.  
\*\* Customer completes **assigned** customer tasks (upload, confirm), not arbitrary crew tasks.

**Matrix is directional** — tune per company in Admin.

---

## Audit requirements (conceptual)

- Permission changes; override actions; quote send; payment record; CO apply.

---

## Open questions

- Fine-grained **per-branch** roles?  
- SOC2 log retention?

---

## Implementation later

- ABAC for enterprise; field offline signing.

---

*Planning canon only.*
