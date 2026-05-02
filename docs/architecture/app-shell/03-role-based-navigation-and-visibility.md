# Role-Based Navigation and Visibility

## Purpose

Define **who** sees **which** parts of the internal shell and **customer/partner** portals, **where** they land after login, and how **one system** uses **filtered surfaces** instead of unrelated apps.

This aligns with: **auth resolves identity → tenant → role → permissions → route and nav** ([04](./04-login-auth-and-portal-model.md)).

---

## Major user groups (canon)

| Group | Typical job in Struxient |
|--------|---------------------------|
| **Owner / Admin** | Company setup, users, permissions, integrations, governance. |
| **Manager** | Cross-job priorities, approvals, crew and customer escalations. |
| **Office / Operations** | Permits, scheduling, materials, customer coordination, invoicing handoffs. |
| **Sales / Estimator** | Leads, opportunities, quotes, follow-up, site visits planning. |
| **Field Worker** | Today’s tasks, proofs, simple status updates. |
| **Crew Lead** | Team today, assignments, field quality, escalate to office. |
| **Customer** | Milestones, uploads, approvals, messages—**portal**, not internal left nav. |
| **Future Partner / Vendor** | Later: limited portal for assigned work (see doc 04). |

---

## Internal left nav visibility (conceptual matrix)

Legend: **Full** = typical access; **Limited** = subset or read-only; **Hidden** = not in nav or blocked by route; **N/A** = not internal app.

| Nav item | Owner / Admin | Manager | Office | Sales | Crew Lead | Field |
|----------|---------------|---------|--------|-------|-----------|-------|
| Work Station | Full | Full | Full | Full | Full | Limited / Full* |
| FlowSpec Builder | Full | Limited | Limited | Limited | Hidden | Hidden |
| Jobs | Full | Full | Full | Limited | Full | Limited |
| Customers | Full | Full | Full | Full | Limited | Hidden |
| Sales | Full | Full | Limited | Full | Hidden | Hidden |
| Finance | Full | Full | Full | Limited | Hidden | Hidden |
| Admin | Full | Limited** | Hidden | Hidden | Hidden | Hidden |
| Catalog | Full | Limited | Limited | Full | Hidden | Hidden |
| Settings | Full | Full | Full | Full | Full | Full |

\* **Field** may use **reduced nav** (Work Station + Jobs + Settings only, or field mode)—**open question** ([06](./06-open-app-shell-questions.md)).  
\*\* **Manager** “Admin” access is often **limited** (invite user vs full billing)—company policy.

**Canon:** Matrix is **directional**; exact permission names are **implementation**.

---

## Default landing route by role (examples)

After successful **internal** auth (see doc 04):

| Role | Default landing (canon direction) |
|------|-----------------------------------|
| Owner / Admin | **Work Station** or **Admin** entry (product choice); many admins still need “what now.” |
| Manager | **Work Station** (Overview or Task Feed). |
| Office / Operations | **Work Station**. |
| Sales / Estimator | **Work Station** **or** **Sales** (company/config—open question). |
| Crew Lead | **Work Station** (field-focused tab). |
| Field Worker | **Work Station** (task-heavy) or **Jobs** last job—open question. |

**Customer:** **Customer Portal** home—not internal nav.

**Future partner:** dedicated **partner portal** route—not full internal nav.

---

## What each role “lives in” day to day

- **Owner / Admin:** **Admin** for changes; **Work Station** for operational pulse; **FlowSpec Builder** / **Catalog** when improving standards.  
- **Manager:** Mostly **Work Station** + **Jobs** drill-down; **Finance** for escalations; **Sales** for big deals.  
- **Office:** **Work Station**, **Jobs**, **Customers**, **Finance** as needed.  
- **Sales:** **Sales** for quote building; **Work Station** for follow-ups and customer requests; **Customers** for CRM.  
- **Crew lead / field:** **Work Station** + **Jobs**; minimal **Customers**/**Sales**/**Finance**.

---

## Internal nav vs portal experiences

| Experience | Left nav | Notes |
|------------|----------|--------|
| **Internal staff** | Full canonical spine (subject to permissions) | One **web app shell** canon. |
| **Customer** | **No** internal left nav | **Portal**: milestones, tasks, uploads, approvals, messages. |
| **Future partner** | **No** full internal nav | Scoped portal pages. |

**Canon:** **One system**, **multiple filtered surfaces**. Customer portal is a **projection** of the same workflow truth ([execution-workflow 08](../execution-workflow/08-customer-view.md)), not a disconnected second product.

---

## How Work Station avoids duplicating modules

Instead of a **separate** “My tasks” app, **Sales queue** app, and **Manager dashboard** app:

- **Work Station** provides **role-tuned feeds** and **deep links** into **Sales**, **Jobs**, **Customers**.  
- **Sales** still owns **quote editor** and **opportunity pipeline** depth.  
- **Jobs** still owns **per-job** runtime detail.

**Principle:** **Navigation is not duplicated**; **attention is aggregated** in Work Station.

---

## Assumptions (not canon)

- Some roles may use **mobile-first** layout with different **order** of tabs.  
- “Hidden” may still allow **deep link** if URL known—product security must gate **data**, not just **hide icons**.

---

## Implementation later

- Permission matrix as data.  
- “Impersonate” or support login for training (Admin-only, audited).
