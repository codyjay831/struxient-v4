# Struxient v4 Entity Map (Conceptual)

## Purpose

Provide a **planning-level** entity relationship map for Struxient v4. **Not** a migration. **Not** final schema. **Not** a claim about current database tables until verified in the Struxient v4 codebase ([audit](../../audit/struxient-v4-canon-to-current-code-mapping.md)).

**CANON:** Boundaries below match [execution-workflow](../execution-workflow/README.md) (line item vs task vs stage; sales vs sold; events).  
**ASSUMPTION:** Physical table names may differ (`QuoteVersion` vs revision row on `Quote`, etc.).

---

## Text diagram (primary spine)

```text
Customer
  ├─ contacts (conceptual)
  ├─ opportunities
  │   └─ quotes
  │       ├─ quote versions (revisions)
  │       ├─ quote line items  ← commercial scope owner
  │       ├─ quote-prep tasks  ← sales lane
  │       └─ planned execution (stages/tasks)  ← dormant until activation
  └─ jobs (sold)
        └─ job workflow instance
              ├─ runtime tasks  ← execution detail
              ├─ stages (runtime / mirrored from plan)
              └─ workflow events
```

---

## Entity definitions (conceptual)

### Customer

| | |
|--|--|
| **Purpose** | Who the company serves; anchor for CRM and projects. |
| **Owns** | Identity, contacts, relationship notes, links to opportunities/jobs. |
| **Does not own** | Internal execution truth alone (shared with Job/Quote). |
| **Relationships** | 1→N opportunities, quotes, jobs. |
| **Lifecycle** | Long-lived. |
| **Source tracking** | Lead source on related opportunity. |
| **Current-code mapping** | Unknown in this repo snapshot — [audit](../../audit/struxient-v4-canon-to-current-code-mapping.md). |

### Opportunity

| | |
|--|--|
| **Purpose** | Possible job; pre-send pipeline ([11](../execution-workflow/11-lead-intake-to-quote-creation.md)). |
| **Owns** | Intake facts, scope intent, sales workflow instance reference. |
| **Does not own** | Sold runtime execution. |
| **Relationships** | Belongs to Customer; 1→N quotes. |
| **Lifecycle** | Open → won/lost/archived. |

### Quote

| | |
|--|--|
| **Purpose** | Commercial + operational blueprint ([03](../execution-workflow/03-quote-to-execution-model.md)). |
| **Owns** | Versions, line items, planned execution, readiness state, assumptions. |
| **Does not own** | Post-sold task completion (Job). |
| **Relationships** | Opportunity; Customer. |

### QuoteVersion

| | |
|--|--|
| **Purpose** | Immutable or versioned snapshot for revision history ([12](../execution-workflow/12-quote-authoring-ux-and-readiness.md)). |
| **Owns** | Point-in-time line items and terms for that version. |
| **Does not own** | Runtime job tasks. |

### QuoteLineItem

| | |
|--|--|
| **Purpose** | **Commercial scope** customer approves and pays for. |
| **Owns** | Title, descriptions, price, visibility, links to planned tasks. |
| **Does not own** | Full execution graph alone (tasks carry detail). |

### PlannedTask (on quote)

| | |
|--|--|
| **Purpose** | **Planned/dormant** execution steps on quote until activation ([06](../execution-workflow/06-sales-vs-sold-execution.md)). |
| **Lifecycle** | Copied or activated into RuntimeTask on sell per rules. |

### Job

| | |
|--|--|
| **Purpose** | Sold work container. |
| **Owns** | Reference to customer, sold quote snapshot or link, job workflow instance. |

### JobWorkflowInstance

| | |
|--|--|
| **Purpose** | Job-owned copy of workflow; mutated by **events**, not by company template ([01](../execution-workflow/01-canon-summary.md)). |

### RuntimeTask

| | |
|--|--|
| **Purpose** | Central operational object at execution ([04](../execution-workflow/04-stages-tasks-outcomes.md), [07](../execution-workflow/07-task-dimensions.md)). |

### WorkflowEvent

| | |
|--|--|
| **Purpose** | Explain **why** state changed ([05](../execution-workflow/05-deterministic-execution-engine.md)). |

### CatalogItem / Packet / WorkflowTemplate (FlowSpec)

| | |
|--|--|
| **Purpose** | Reusable building blocks ([catalog](../catalog/struxient-v4-catalog-packets-and-templates.md), [flowspec](../flowspec/struxient-v4-flowspec-builder.md)). |

### StageDefinition / TaskDefinition / OutcomeRule

| | |
|--|--|
| **Purpose** | Blueprint-level definitions on template/FlowSpec. |

### ScheduleEvent / AvailabilityWindow

| | |
|--|--|
| **Purpose** | Time facts and windows ([13](../execution-workflow/13-calendar-and-scheduling-model.md)). |

### PaymentGate

| | |
|--|--|
| **Purpose** | Rule/fact blocking or warning execution until satisfied ([finance](../finance/struxient-v4-finance-and-payment-gates.md)). |

### ChangeOrder

| | |
|--|--|
| **Purpose** | Controlled post-sold change ([change-orders](../change-orders/struxient-v4-change-orders-and-revisions.md)). |

### Attachment / Evidence

| | |
|--|--|
| **Purpose** | Files and proof ([evidence](../evidence/struxient-v4-attachments-photos-evidence.md)). |

### CustomerPortalShare

| | |
|--|--|
| **Purpose** | Scoped access token or link set for customer portal ([customer-portal](../customer-portal/struxient-v4-customer-portal-mvp.md)). |

### Request / Notification

| | |
|--|--|
| **Purpose** | Structured asks and surfacing mechanism ([communication](../communication/struxient-v4-requests-messages-notifications.md)). |

### User / Role / Permission / Tenant

| | |
|--|--|
| **Purpose** | AuthZ model ([security](../security/struxient-v4-permissions-matrix.md), [app-shell 04](../app-shell/04-login-auth-and-portal-model.md)). |

---

## Important boundaries (canon)

- **Line item** owns **commercial scope**; **task** owns **execution detail**; **stage** organizes **timing**.  
- **Quote-prep tasks** ≠ **runtime job tasks** after activation.  
- **Planned execution** → **runtime tasks** only per **activation rules**.  
- **Events** explain changes; customer portal reads **filtered projections** ([08](../execution-workflow/08-customer-view.md)).

---

## Open questions

- Single `Quote` row with JSON plan vs normalized `PlannedTask` table?  
- `WorkflowEvent` table vs audit log service?  
- Versioning: `QuoteVersion` vs event-sourced replay?

---

## Implementation later

- ER diagram in tooling; Prisma schema review against this map.  
- Populate **Current-code mapping** column per entity in audit doc.

---

*Planning canon only.*
