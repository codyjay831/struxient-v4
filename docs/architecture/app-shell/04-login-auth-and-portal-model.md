# Login, Auth, and Portal Model

## Purpose

Define **how users enter** Struxient, how **identity** connects to **tenant**, **role**, and **permissions**, and how the system **routes** people to the right **surface** (internal app vs customer portal vs future partner portal).

---

## Main entry experiences (canon)

| Entry | Who | What it is |
|-------|-----|------------|
| **1. Internal Auth Portal** | Employees, staff, owners with company login | Standard **tenant-aware** staff authentication into the **internal shell**. |
| **2. Customer Portal** | Homeowners, property managers, commercial customers | **Filtered** experience: milestones, requests, uploads, approvals—same workflow truth as internal ([execution-workflow 08](../execution-workflow/08-customer-view.md)). |
| **3. Future Partner / Vendor Portal** | Subs, engineering partners, suppliers (later) | **Scoped** access to assigned work or tickets—not full internal nav; **future-facing**. |

---

## Internal Auth Portal

**Purpose:** Establish **who** is logging in **for which company** (tenant), then load the **internal** product shell.

**Canon behaviors (conceptual):**

- **Employee / staff / admin** use company-approved login (email/password, SSO, or other—**implementation later**).  
- **Invite / onboarding** may exist: admin sends invite → user sets password / accepts terms (**implementation later**).  
- **Tenant / company-aware auth:** every session knows **which organization** the user acts in; multi-company users pick org if applicable.  
- **Role resolution after login:** roles and fine-grained permissions load from **Admin**-governed data.  
- **Default post-login route:** typically **Work Station** for operational roles ([02](./02-work-station-surface.md), [03](./03-role-based-navigation-and-visibility.md)).  
- **Secure auth expectations:** industry-standard practices (session expiry, HTTPS, etc.); **MFA** as **implementation later** where required by customer tier or policy.

**Principle chain (canon):**

1. **Auth** proves **identity**.  
2. **Auth + directory** resolve **tenant** and **membership**.  
3. **Membership** resolves **role** and **permissions**.  
4. **Router** sends the user to the **default surface** and **builds nav** from permissions.  
5. **Every action** is checked against permissions—not only the initial page.

---

## Customer Portal

**Purpose:** Let the customer **participate** in their project without seeing internal margin notes or the full job graph.

**Entry methods (canon options—not “already shipped” claims):**

- Secure **magic link** from email/SMS  
- **Account** login (email + password or passkey—implementation later)  
- **Project-scoped** link with token expiry  

**Customer should be able to (where product enables):**

- See **milestones** / status aligned with internal truth  
- **Upload** requested photos or documents  
- **Confirm** schedule or access windows  
- **Approve** quotes or change orders  
- **Review** messages or shared documents (product-defined)

**Canon:** Customer portal is a **filtered projection** of the **same** workflow, tasks, and events—not a second disconnected system that drifts.

---

## Future Partner / Vendor Portal

**Future-facing canon:**

- Partners see **only** work assigned to them (tasks, documents, dates).  
- Same **auth stack** as internal vs separate stack is an **open question** ([06](./06-open-app-shell-questions.md)).  
- Does **not** replace **internal** Jobs for **your** crew’s work—**scopes** differ.

---

## Default post-auth routing examples

| Persona | Example first screen |
|---------|----------------------|
| Manager | **Work Station** |
| Office | **Work Station** |
| Sales | **Work Station** **or** **Sales** (company preference) |
| Field | **Work Station** (field-focused) |
| Customer | **Customer Portal** home |
| Admin | **Work Station** or **Admin** landing |

Routing is **permission-based**: a user without **Sales** access is never sent to Sales home even if URL is typed (show forbidden or redirect).

---

## Login and routing concepts (summary)

- **Login page** ≠ “the whole product”—it is the **airlock**.  
- **Tenant** context prevents cross-company data leaks.  
- **Role** shapes **default** experience; **permissions** shape **every** nav item and action.  
- **Customers** never share the **internal left nav**; they use **portal routes** only.

---

## Assumptions (not canon)

- Single sign-on vendor and MFA policy are **enterprise** decisions.  
- Whether customers have one login across multiple jobs at same contractor is **product** TBD.

---

## Implementation later

- Session refresh, token rotation, device binding.  
- Audit log of logins and permission changes.  
- Customer account linking to internal Customer record.
