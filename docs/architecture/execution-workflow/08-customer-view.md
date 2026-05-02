# Customer View

The **customer view** is a **filtered projection** of the **same workflow truth** the office and field use—not a second disconnected workflow that drifts out of sync.

---

## Core principle

- **One model** for stages, tasks, line items, milestones, and events.  
- **Visibility settings** and **milestone mapping** decide what the customer sees and when.  
- Customer actions (approve, upload photo, confirm window) are **real tasks or events** on that same graph, surfaced through a **customer-appropriate UI**.

---

## Visibility settings (canon examples)

Per task, stage, or line item (exact granularity is implementation):

| Setting | Who sees what |
|---------|----------------|
| **Internal only** | Office/field only |
| **Customer visible** | Customer sees **friendly label** and status |
| **Customer approval required** | Customer must explicitly approve to satisfy gate |
| **Customer upload/input required** | Customer must provide file or answer |
| **Customer status only** | High-level state without internal task names |

---

## Internal tasks vs customer-facing labels

**Internal task names** can be technical and operational. **Customer-facing labels** group or rename work into milestones customers understand.

**Examples:**

| Internal work (examples) | Customer milestone / label |
|--------------------------|----------------------------|
| Submit permit, respond to AHJ correction, upload revised plan | **Permit in progress** |
| Schedule crew, truck stock check | **Installation scheduled** (when policy says so) |
| Pull #6 THHN, torque lugs, verify breaker compatibility | Shown only if you **want** deep detail; usually **not** |

---

## Customer milestones (example journey)

What a homeowner might see for an EV charger job:

1. **Quote sent** (or Project approved — wording is product copy)  
2. **Site review complete**  
3. **Permit in progress**  
4. **Installation scheduled**  
5. **Inspection pending**  
6. **Corrections required** (only if true)  
7. **Project complete**  

These milestones **map** to internal stage/task progress via **rules**, not duplicate tracking spreadsheets.

---

## Customer approval and input tasks

Some tasks **require** the customer:

- Approve **change order**  
- Confirm **access window**  
- **Upload** photo of panel or utility space  
- Acknowledge **safety** or HOA form  

In canon, those are still **tasks** (or structured customer events linked to tasks) with **customer visibility** flags and **gates** that block downstream work until satisfied.

---

## Examples (canon)

### Internal-only: margin and discounts

- **Task:** Review margin  
- **Customer visible:** No  

### Customer-visible install

- **Task:** Install EV charger (internal checklist)  
- **Customer visible:** Yes, as **“Installation”**  

### Customer provides evidence

- **Task:** Upload panel photo  
- **Customer visible:** Yes; customer can **upload** without seeing internal AHJ notes.

### Manager-only

- **Task:** Manager approve discount  
- **Customer visible:** No  

---

## Relationship to EV Charger example

From the product canon:

**Customer view milestones** for **Smith Residence EV Charger** can include: Quote sent → Site review complete → Permit in progress → Installation scheduled → Inspection pending → Project complete—while internal staff see every permit subtask and material line.

---

## Assumptions (not canon)

- Whether the customer portal reads the same API with stricter filters vs a dedicated “projection service” is architecture TBD.
- How much history customers see (failed inspection details vs “we’re resolving an issue”) is policy and legal review.

---

## Implementation later

- Milestone definition language (per template vs per job override).
- Redaction rules for attachments on customer-visible tasks.
