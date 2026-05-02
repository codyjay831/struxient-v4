# App Shell — Product Surface & Navigation Canon

## Why these documents exist

Struxient’s **execution workflow** docs describe *what* the system believes about work: templates, quotes, jobs, tasks, outcomes, determinism, customer view, lead intake, and the Work Station *concept*. This folder describes the **product shell** around that canon: **how people enter the product**, **how they move around it**, and **which major surface owns which questions**.

Together, the goal is for Struxient to feel like an **operating system for construction workflow**—not a loose pile of unrelated pages.

## What this folder is (and is not)

| This folder **is** | This folder **is not** |
|--------------------|-------------------------|
| **Canon** for left navigation, Work Station, roles, login, portals, and surface ownership | A description of “final” current UI (unless a line explicitly says it is an observation of today’s app) |
| **Product / information architecture** planning | Implementation specs, routes, or component tickets |
| Contractor-friendly language for alignment | Schema changes, migrations, or code |

## Relationship to execution workflow docs

These docs **complement** [execution-workflow](../execution-workflow/README.md); they do **not** replace them.

- **Execution workflow** = truth model: stages, tasks, quotes, jobs, engine, lead → quote, customer projection.  
- **App shell** = **where** users live in the product and **which area answers which question**.

**Work Station** (in canon) is the **center of internal day-to-day operation**: the default place to answer **“what now?”** for most roles. Other nav areas support **authoring**, **records**, **sales pipeline**, **money**, **governance**, and **reusable building blocks**.

**Login / auth / portals** define **how users enter** the system: internal staff vs customer vs (later) partner—and how **identity, tenant, role, and permissions** decide **which surface** they see first and **what** they can open.

## Documents in this folder

| File | Purpose |
|------|---------|
| [01-left-navigation-model.md](./01-left-navigation-model.md) | Canonical internal left nav: each item’s purpose, ownership, users, boundaries, relationships |
| [02-work-station-surface.md](./02-work-station-surface.md) | Work Station as command center: tabs, feed categories, context rail, role variants |
| [03-role-based-navigation-and-visibility.md](./03-role-based-navigation-and-visibility.md) | Roles, visibility, default landings, internal vs portal |
| [04-login-auth-and-portal-model.md](./04-login-auth-and-portal-model.md) | Internal auth, customer portal, future partner portal; routing principles |
| [05-surface-ownership-map.md](./05-surface-ownership-map.md) | “Where do I go for X?”—concerns mapped to surfaces and cross-links |
| [06-open-app-shell-questions.md](./06-open-app-shell-questions.md) | Open product/IA questions only—no answers unless implied by canon |

## How to read this set

1. Start with **01** for the **spine** of the internal product.  
2. Read **02** for **day-to-day** internal experience.  
3. Use **03** and **04** for **who sees what** and **how they sign in**.  
4. Use **05** as a **quick map** from question → surface.  
5. Use **06** for implementation and UX backlog discussions.

---

*Product shell / navigation / portal planning canon. Not a claim about current production UI unless explicitly noted as observation.*
