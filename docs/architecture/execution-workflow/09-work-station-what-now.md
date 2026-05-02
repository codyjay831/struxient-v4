# Work Station and “What Now?”

The **active job experience** (and the **multi-job day** for managers) should optimize for **execution clarity**, not for staring at a static workflow diagram.

---

## Execution-first questions

The product should routinely answer:

1. **What should happen now?**  
2. **Who should do it?**  
3. **Why is it ready?**  
4. **What is blocked?**  
5. **What fixes the blocker?**  
6. **What happens after this?**  

**Work Station** (conceptual product surface) is the **role-aware home** for those answers. Users should **not** need to inspect the **full workflow graph** to know what to do next—the engine **derives** priority and explanations.

---

## Work feed categories (canon)

Organize derived work into clear buckets:

| Category | Plain language |
|----------|----------------|
| **Now** | Ready to start or finish today / this moment |
| **Next** | Likely soon; dependencies clearing; soft priority |
| **Blocked** | Cannot proceed until specific facts change |
| **Waiting** | External: customer, AHJ, supplier, partner |
| **Needs Review** | Human decision: scope, discount, failed QC note, etc. |
| **Scheduled** | Booked in calendar sense (may still be blocked if facts change) |
| **Done** | Completed, skipped appropriately, or superseded with history |

### Example layout (illustrative)

**NOW**

- Upload permit approval  
- Order breaker  
- Schedule install  

**NEXT**

- Install EV charger  
- Upload install photos  
- Schedule inspection  

**BLOCKED**

- **Final inspection**  
  - **Reason:** Install task not complete; required install photos missing; payment gate “Install balance” not satisfied  
  - **Possible fixes:** Open install task; request photos from crew; mark payment received  

**WAITING**

- **Customer availability**  
  - **Reason:** Customer has not confirmed access window  

---

## Blocked work must be useful

**Bad:** “Final inspection is blocked.”

**Good:** “Final inspection is blocked **because** …” with **checklist reasons** and **suggested actions** that map to real tasks or data entry.

This behavior comes from the **deterministic engine** reading **facts** (doc 05), not from generic string templates only.

---

## Task card execution clarity (canon)

Every **task card** should help a human **execute**, not only **track**. Target prompts:

- **Why this task?** — Source: line item, template, correction, change order, …  
- **Why now?** — Dependencies cleared, stage active, gate satisfied, …  
- **What is required to finish it?** — Proof, forms, materials on site, …  
- **What happens after?** — Next task becomes ready, stage completes, customer sees milestone X, …  
- **What is blocking it?** — If not ready: explicit reasons.  
- **Who owns it?** — Role, team, individual, partner.  
- **Is it customer-visible?** — Label shown to homeowner if any.  

**Example: Schedule Final Inspection**

- **Why now:** Install stage complete and required photos uploaded (facts).  
- **Required:** Pick date/time, assign on-site contact, confirm AHJ.  
- **After completion:** Inspection task becomes ready; Closeout may remain blocked until inspection **passes** (per rules).  

---

## Role-aware views (examples)

### Office user

**Ready now:** Submit permit for Smith job; call customer for access window; review failed inspection note.  

**Blocked:** Jones install blocked by missing breaker; Smith closeout blocked by inspection outcome.  

**Needs decision:** Panel issue found — approve change order?

---

### Field worker

**Today:** Go to Smith residence; install EV charger; upload required photos; mark test result.  

**Blocked:** Johnson job not ready — permit still pending (with link to **why** if they have permission to see it).

---

### Manager

**Critical:** 3 jobs blocked by customer availability; 2 installs missing material; 1 failed inspection needs assignment.  

**Next best actions:** Assign Crew A to Smith install; approve change order for Jones panel issue.

Each view is a **filter + ranking** of the same underlying work, not three conflicting boards.

---

## Relationship to deterministic engine

Work Station content is **derived output** (doc 05): same facts → same categories and ordering rules. **User actions** append **events** and trigger **recalculation**.

---

## Assumptions (not canon)

- Whether “Work Station” is one screen with tabs vs separate apps for field is UX—not model—decision.
- Push notifications vs in-app only is channel design outside this canon.

---

## Implementation later

- Cross-job **manager** aggregation queries and indexes.
- “Snooze” or “focus mode” without breaking determinism (snooze is a fact with expiry).
