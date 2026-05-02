# Struxient v4 Attachments, Photos, and Evidence

## Purpose

Define how **files** flow through Struxient v4 so they are **linked**, **labeled**, **permissioned**, and **reused** as context—not orphaned blobs. Aligns with [08-customer-view](../execution-workflow/08-customer-view.md), [12](../execution-workflow/12-quote-authoring-ux-and-readiness.md), and task **proof** ([07](../execution-workflow/07-task-dimensions.md)).

**CANON:** **Attachment** = file linked to a record. **Evidence** = attachment or structured proof that **satisfies** a task requirement.

---

## Lifecycle stages (examples)

- **Lead intake** photos → opportunity / intake facts.  
- **Customer portal** uploads → request fulfillment.  
- **Quote context** files → visible while authoring ([12](../execution-workflow/12-quote-authoring-ux-and-readiness.md)).  
- **Site visit** evidence.  
- **Task completion proof** (install photos, test results).  
- **Inspection** documents.  
- **Permit** PDFs.  
- **Change order** attachments.  
- **Closeout packet** (warranty, as-builts).

---

## Carry-forward (canon)

Same panel photo from intake may appear as **quote context** and later as **install task context** after activation—**by reference** or **immutable copy** per implementation; not by duplicating “upload panel photo” as unrelated records without linkage.

---

## Labels / categories

Examples: `panel_photo`, `charger_location`, `permit_pdf`, `inspection_failure`, `customer_id`. Supports search, readiness (“panel photo required”), and customer projection.

---

## Customer-visible vs internal-only

| Visibility | Use |
|------------|-----|
| Customer-visible | Shown on portal or proposal when policy allows |
| Internal-only | Margin notes, supplier invoices, internal QC |

---

## Evidence requirements

Tasks declare **required proof**; engine/readiness checks presence ([05](../execution-workflow/05-deterministic-execution-engine.md), [12](../execution-workflow/12-quote-authoring-ux-and-readiness.md)).

---

## Examples

- Panel photo at intake → quote builder context → install task **reference**.  
- Install proof required before inspection scheduling **ready**.  
- Inspection failure PDF → spawns correction tasks ([04](../execution-workflow/04-stages-tasks-outcomes.md)).

---

## Open questions

- Object storage (S3) vs local dev?  
- Virus scan pipeline?  
- Retention policy / GDPR delete?

---

## Implementation later

- EXIF strip for privacy; thumbnail pipeline; signed URLs with TTL.

---

*Planning canon only.*
