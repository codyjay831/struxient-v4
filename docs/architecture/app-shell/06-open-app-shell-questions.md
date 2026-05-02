# Open App Shell Questions

Open **product / information architecture** questions only. **Do not** treat answers below as decided unless canon elsewhere already implies a direction.

---

## Left nav and IA

- Should **Sales** be a top-level nav item for **all** companies, or only when a **feature** (CRM/pipeline) is enabled?  
- Should **Finance** stay a **separate** top-level item, or be **partly embedded** in Jobs and/or Sales (e.g., “Billing” tab on job)?  
- Should **field workers** see the **full** left nav or a **reduced** nav (Work Station + Jobs + Settings)?  
- Should **Analytics** live under Work Station only, or also under Admin as **company analytics**?  
- Should **Requests** merge with **Task Feed** or stay separate for clarity?  
- How many **badges** on top-level nav are acceptable before cognitive overload?

---

## Work Station

- Should **Work Station** **always** be the default home for **Sales** users, or should **Sales** (pipeline) be default for some companies?  
- How do **unread messages** and **open requests** affect **nav badges** vs **Work Station** counts?  
- How should **context rail** content differ by **role** (field vs manager vs sales)?  
- Should **All Projects** include **open opportunities** or only **sold jobs**?  
- What is the **minimum** useful Work Station for **v1** (single feed vs full tabs)?

---

## Catalog

- Should **Catalog** include **materials/equipment libraries**, or only **quote/work packets** and line item templates?  
- How do **Catalog** items **version** when a job was sold under an older packet?

---

## Admin vs Settings

- How exactly should **Admin** vs **Settings** be **split** for users who are both **admin** and **personal user**?  
- Should **company branding** (logo on customer portal) live in Admin only?

---

## Auth and portals

- What is the **minimum viable customer portal** for first release (milestones only vs uploads vs approvals)?  
- Should **partner/vendor portal** share the **same auth stack** and user table as internal staff, or isolated identities?  
- **Magic link** vs **password** default for customers—security vs support tradeoff?  
- **Multi-org users** (consultant across contractors): how does **tenant picker** interact with default landing?

---

## Mobile and responsive

- How should **mobile navigation** differ from **desktop** while preserving the **same canon** (reduced nav vs hamburger vs bottom tabs)?  
- Should **field** users get a **dedicated mobile shell** that **hides** desktop-first areas?

---

## Permissions and security

- Should **deep links** to Admin be **blocked** entirely for non-admins or show **403**?  
- How are **customer portal** links **scoped** (job-only vs customer-account-wide)?

---

## Naming and branding

- Is **FlowSpec Builder** the customer-facing name, or a **working title** only?  
- Should internal areas use **construction** vocabulary (“Jobs”) vs **CRM** vocabulary (“Projects”) consistently in UI?

---

## Assumptions (not canon)

- This list will grow after first UX review; it is not complete.

---

## Implementation later

- Turn resolved questions into ADRs or ticket epics outside this doc set.
