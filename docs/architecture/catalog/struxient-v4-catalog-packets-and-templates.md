# Struxient v4 Catalog — Packets and Templates

## Purpose

Define **Catalog** as the home for **reusable building blocks**: what it **owns**, how it **feeds** Sales, quote authoring, and FlowSpec Builder, and how **versioning** avoids corrupting **sold** work. Aligns with [app-shell Catalog](../app-shell/01-left-navigation-model.md) and [execution-workflow](../execution-workflow/01-canon-summary.md) reuse levels.

**CANON:** Catalog items are **blueprints**; **quotes/jobs** get **copies**; changing catalog does **not** silently rewrite historical sold work.  
**ASSUMPTION:** Material assemblies may or may not live in Catalog v1 ([app-shell 06](../app-shell/06-open-app-shell-questions.md)).

---

## What Catalog includes (conceptual)

- **Line item templates** — reusable commercial line with default pricing mode, descriptions.  
- **Service offerings** — sellable SKUs or service types the company lists.  
- **Quote packets** — bundle: line item(s) + default assumptions + optional planned tasks.  
- **Execution packets / task bundles** — reusable set of tasks/materials/proofs.  
- **Material / equipment assemblies** (optional) — BOM-like presets.  
- **Default planned execution** snippets attachable to templates or packets.  
- **Customer-facing** and **internal** default text.  
- **Versioning** metadata (draft, published, deprecated).  
- **Save from quote/job** back to catalog (**explicit** user choice per canon).

---

## Differences (contractor-friendly)

| Artifact | What it is |
|----------|------------|
| **Line item template** | Reusable **commercial** line: what you sell and default price/copy. |
| **Packet** | Reusable **chunk of work**: may combine **line + tasks + materials + assumptions** for a common job slice (e.g., EV charger install core). |
| **Workflow template / FlowSpec** | **Process** structure: stages, task definitions, outcome rules ([flowspec](../flowspec/struxient-v4-flowspec-builder.md)). |
| **Material assembly** | Reusable list of **parts/equipment** often ordered together. |

---

## Examples

- **EV charger install packet** — Wall connector line + permit/procurement/install/inspection task bundle + default photos required.  
- **Panel upgrade packet** — Line + engineering/permit/heavy material assumptions.  
- **Solar inspection correction packet** — Tasks for reinspection loop after fail outcome.  
- **Pressure washing simple packet** — Single line + minimal tasks for light trades.

---

## What Catalog owns

- **Reusable definitions** and **version** history pointers.  
- **Publishing** workflow (with Admin/permissions [security](../security/struxient-v4-permissions-matrix.md)).

## What Catalog does not own

- **Runtime** task state on a specific job.  
- **Customer-specific** negotiation history (lives on Quote/Opportunity).

---

## How Catalog feeds other surfaces

| Consumer | Use |
|----------|-----|
| **Sales / quote authoring** | Insert line items and packets; prefill planned execution ([12](../execution-workflow/12-quote-authoring-ux-and-readiness.md)). |
| **FlowSpec Builder** | Reference catalog tasks/materials in template definitions. |
| **Quote workspace** | Pull customer-facing defaults and internal checklists. |

---

## Versioning (conceptual)

- **Publish** creates an immutable **version** customers/jobs can reference.  
- **Draft** edits do not affect in-flight quotes until user **updates** quote from new version (explicit).  
- **Sold jobs** keep **snapshot** of what was sold/planned at activation—not live-linked to mutable catalog row.

---

## Avoid mutating sold work

When catalog changes after a job was sold:

- **Runtime** tasks already created stay tied to **job snapshot** or version id.  
- **New** jobs pick up **new** catalog version when user selects it.  
- **Change orders** handle mid-job scope changes ([change-orders](../change-orders/struxient-v4-change-orders-and-revisions.md)).

---

## Open questions

- Catalog in **SQL** vs **CMS** vs **hybrid**?  
- Who can **publish** vs **draft**?  
- Cross-company marketplace (probably never MVP).

---

## Implementation later

- Diff UI between catalog versions.  
- Import/export packets for franchises.

---

*Planning canon only.*
