# Calendar and Scheduling Model

## Purpose

This document defines the **intended calendar and scheduling model** for Struxient: how the product moves from **“tasks and jobs that need to happen”** to **“the best time, crew, and sequence—with blockers and conflicts explained.”**

It **complements** [execution-workflow](./README.md) (readiness, tasks, engine, customer view, quotes) and [app-shell](../app-shell/README.md) (Work Station **Schedule** tab/lens, Jobs, Sales). It does **not** assert that **current** UI or code matches this canon.

**Core canon:**

- **Calendar** is the **visual / time-based lens** (day, week, month, resource lanes).  
- **Scheduling** is the **readiness-aware decision layer** (constraints, conflicts, recommendations, events).  
- A calendar can show **bookings**; the **scheduling layer** must know whether those bookings are **safe, ready, risky, blocked, or waiting**—and **why**.  
- The **calendar is not the only source of truth**. The schedule is a **projection** of **task/job facts** plus **scheduled-time facts** plus **readiness facts** ([05](./05-deterministic-execution-engine.md)).

**Scheduling is part of execution**, not “just a pretty grid.”

---

## Relationship to existing canon

| Canon elsewhere | Here |
|-----------------|------|
| [09-work-station-what-now.md](./09-work-station-what-now.md) | Work Station is **“what now?”**; may include a **Schedule** tab/lens ([app-shell 02](../app-shell/02-work-station-surface.md)). |
| [07-task-dimensions.md](./07-task-dimensions.md) | **Time estimate** vs **scheduled time** are separate dimensions. |
| [05](./05-deterministic-execution-engine.md) | Engine reads **schedule facts** and **readiness facts** together. |
| [11](./11-lead-intake-to-quote-creation.md) | **Customer availability** can carry forward from intake. |
| [12](./12-quote-authoring-ux-and-readiness.md) | Quotes may hold **schedule assumptions**; **real** crew booking usually post-sell when dependencies are firmer. |
| [03](./03-quote-to-execution-model.md), [06](./06-sales-vs-sold-execution.md) | **Payment gates**, materials, permits **block** or **risk-label** execution—including **schedule** state. |
| [08](./08-customer-view.md) | Customer sees **filtered** schedule milestones—not internal overbooking notes. |

**Scheduling spans surfaces:** Work Station, **Jobs**, **Sales/Quotes** (assumptions, promises), **Customer portal** (availability, confirmations), **Finance** (payment gates), **Catalog / FlowSpec** (default durations, skill tags on templates)—one **model**, many **views**.

---

## Calendar vs scheduling

| | **Calendar** | **Scheduling** |
|---|--------------|----------------|
| **What it is** | Visual representation of **time** | **Logic and workflow** for **placing** and **evaluating** work on time |
| **Shows** | Day/week/month/**resource** views; who/what/where/when | Readiness, conflicts, recommendations, **explanations** |
| **Interaction** | Drag/reschedule **if policy allows** | Validates or warns; may **block** or require **override** |
| **Truth** | **Projection** of underlying facts | **Rules + facts** that decide schedulability and risk |

**Canon:** **Calendar is the lens. Scheduling is the logic.**

---

## Scheduling tied to execution readiness

A task should **not** be scheduled **blindly**. Scheduling considers (non-exhaustive):

- Task **readiness**; **stage** status  
- **Preferred order** vs **hard dependencies** ([04](./04-stages-tasks-outcomes.md))  
- **Crew / team / individual** availability  
- **Customer availability**; job/site **access** windows  
- **Material** and **equipment** readiness  
- **Permit / AHJ** status  
- **Payment gates**  
- Required **proof** / preconditions  
- **Estimated duration**; travel / **route grouping** (future-facing)  
- **Skill / license** requirements  
- **Weather** or site conditions (future-facing)  
- **Priority / urgency**  
- **Conflicts** with existing bookings  
- **Customer commitments** and internal **capacity**

**Scheduled ≠ always ready.**  
Facts can change after booking: e.g., install **on the calendar** for Tuesday but **breaker not received** → show **scheduled** with **at risk** or **blocked** and reason: *“Required breaker not received.”*

---

## Schedulable objects

**What can be scheduled** (examples):

- **Task** (runtime or quote-prep where product allows timeboxing)  
- **Stage** milestone (start/end window)  
- **Job visit** / **site visit** / **estimate appointment**  
- **Install** / **inspection** appointment  
- **Customer call**; **internal review** meeting  
- **Crew block** (PTO, training, truck down)  
- **Material pickup**; **partner/vendor** appointment  
- **Follow-up reminder**  

Each object should know (conceptually): **link** to job/task/opportunity; **owner**; **where**; **expected duration**; **role/team/skill**; **customer visibility**; **readiness conditions**; whether it **blocks** or is **blocked by** other work.

### Distinguish types

| Concept | Meaning |
|---------|---------|
| **Scheduled task** | Task with **scheduled start/end** (or window) tied to execution graph |
| **Calendar event** | Time block on calendar—may mirror task or be a **hold** |
| **Availability window** | When customer/crew **can** work—not itself “the install” |
| **Reminder** | Nudge; may not reserve capacity |
| **Hold / block** | Reserved time or “do not book” marker |

---

## Time estimate vs scheduled time

Aligned with [07-task-dimensions.md](./07-task-dimensions.md):

| | **Time estimate** | **Scheduled time** |
|---|-------------------|---------------------|
| **Meaning** | “This usually takes **~3 hours**.” | “Booked **Tuesday 8:00–11:00**.” |
| **Typical phase** | **Quote** / planning | **Execution** / dispatch |

A task may carry: estimated duration; **earliest start**; **due** date; **preferred** window; **scheduled** start/end; **actual** start/end; **travel buffer**; **reschedule history**.

**Quote** → mostly **estimates** and assumptions. **Sold execution** → **real** scheduled times drive field and customer commitments.

---

## Schedule readiness

A task (or schedulable object) can sit in categories such as:

| State | Plain meaning |
|-------|----------------|
| **Not schedulable** | Missing duration, owner, address, or undefined upstream dependency |
| **Schedulable but not ready** | Could place **tentatively** while waiting on permit/material/etc. (policy-dependent) |
| **Ready to schedule** | Permit/material/customer/deps satisfied per template |
| **Scheduled and ready** | On calendar **and** facts still support execution |
| **Scheduled but at risk** | Booked but e.g. material **expected** not **received** |
| **Scheduled but blocked** | Booked but e.g. **payment gate** failed since booking |
| **Completed** / **Canceled** / **Rescheduled** | Terminal or moved states |

**Examples:**

- **Ready to schedule:** Permit approved, materials ready, customer windows known, dependencies clear.  
- **Schedulable but not ready:** **Tentative** install while permit pending (if company allows).  
- **Scheduled at risk:** Install on calendar; breaker in transit.  
- **Scheduled blocked:** Install on calendar; deposit gate no longer satisfied.  
- **Not schedulable:** No duration, no crew pool, or customer address missing for field dispatch.

---

## Work Station schedule lens

[09](./09-work-station-what-now.md); [app-shell 02](../app-shell/02-work-station-surface.md).

The **Schedule** tab/lens should show:

- **Today’s** scheduled work  
- **Upcoming** scheduled work  
- **At-risk** scheduled work  
- **Blocked** scheduled work  
- **Unscheduled** but **ready** work  
- Work **needing scheduling**  
- **Waiting** on customer availability  
- **Crew capacity** issues  
- **Overdue** unscheduled tasks  
- **Conflicts**  

**Examples:**

**NOW:** Crew A install at Smith, 8:00 AM; call Jones customer to confirm access.  
**NEEDS SCHEDULING:** Final inspection for Smith; site visit for new EV lead.  
**AT RISK:** Tuesday install may slip—breaker not received.  
**BLOCKED:** Johnson install cannot be scheduled—permit not approved.  
**WAITING:** Customer has not confirmed access window.

Deep links into **Job**, **Quote**, **Task**, **Customer**, or **availability request**—not orphaned calendar rows.

**Canon:** Work Station answers **“what now?”** Calendar answers **“when?”**—they **share** the same underlying schedule + readiness facts.

---

## Jobs calendar / per-job schedule

Inside a **Job**, the schedule view should show:

- Scheduled **tasks/visits** for **this** job  
- **Stage** timeline; **upcoming milestones**  
- **Customer-visible** appointments vs **internal-only** tasks  
- **Readiness** and **blockers** on scheduled items  
- **Reschedule** and **inspection** history  

**Per-job schedule should answer:**

- What is **scheduled** for this job?  
- What is the **next booked** event?  
- What still **needs scheduling**?  
- What **schedule blockers** exist?  
- What **changed** since the original plan?  

---

## Global calendar

**Global calendar** may show: all scheduled jobs/tasks; **crew/resource lanes**; day/week/month; **filters** (role, team, person, status, job type); **at-risk/blocked** overlays; customer-facing vs internal events; **unassigned** work needing a slot.

**Canon:** Global calendar does **not** replace Work Station. It is a **when/where/who** map; **Work Station** remains the **command center** for **action** and **explanation**.

**Implementation later:** whether global calendar lives primarily under Work Station, **Jobs**, or a dedicated route ([Assumptions](#assumptions-not-canon)).

---

## Crew / resource scheduling

Scheduling should support:

- **Role**, **team**, **individual** assignment  
- **Skill / license** requirements (e.g., electrical qualification)  
- **Capacity**, working hours, **time off**  
- Home base / **territory** (if known)  
- **Equipment / truck** availability  
- **Overbooking** warnings  

**Example:** Install EV charger requires **C10-qualified** crew—the system should **not recommend** a crew missing that requirement (unless **override** recorded).

---

## Customer availability and access

**First-class scheduling input.**

Customers may provide: availability **windows**; **blackout** dates; **preferred** times; **access** instructions (gate, parking, pets, tenants); vacation; **contact-on-arrival** preference.

**Sources:** Lead intake ([11](./11-lead-intake-to-quote-creation.md)); **customer portal**; phone; office entry; **reschedule** request.

**Scheduling system should:**

- Use windows to **recommend** slots  
- Show **conflicts**  
- **Request** missing availability when template requires  
- **Block** or **warn** if access unknown per policy  
- **Preserve** access notes on scheduled work  

---

## Material, equipment, permit, payment readiness

Scheduling understands major **blockers**:

**Materials:** required items identified → ordered → received → staged/picked up.  
**Equipment:** assigned / reserved / available.  
**Permit/AHJ:** not required → pending → approved; inspection scheduled/passed/failed.  
**Payment:** deposit required → gate satisfied / missing; finance hold.

**Examples:**

- Install **cannot** be scheduled until permit approved **OR** only **tentative** if policy allows.  
- Inspection **cannot** be scheduled until install **complete** and **proof** uploaded ([04](./04-stages-tasks-outcomes.md)).  
- Crew assignment **after** material received **or** **manual override** with audit.  

---

## Schedule recommendations

The system should be able to **suggest** (with **reasons**, not black box):

- Best **install window**; best **crew/team**  
- Next **customer contact** time  
- **Route grouping** (future)  
- **Earliest safe** vs **earliest risky** date  
- **Why** a date is **not** recommended  
- **What** must happen to make a date **ready**  

**Explanation examples (canon tone):**

- *“Recommended Wednesday 8 AM: Crew A available, customer available, permit approved, breaker received, payment gate satisfied, duration fits.”*  
- *“Tuesday is risky: breaker expected but not received.”*  
- *“Friday is blocked: payment gate not satisfied.”*  
- *“No valid windows this week: customer availability and crew capacity do not overlap.”*

---

## Rescheduling

**Causes:** Customer unavailable; crew unavailable; **material/permit** delay; weather; failed inspection; scope change; payment issue; emergency priority; office decision.

**Reschedule should record:** old/new time; **reason**; **who** changed; customer **notified** or not; **downstream** effects; related tasks moved or not.

**Events (examples):** `TASK_RESCHEDULED`; `CUSTOMER_DELAY_RECORDED`; `CREW_UNAVAILABLE`; `MATERIAL_DELAY`; `PERMIT_DELAY`; `INSPECTION_RESCHEDULED`—aligned with [05](./05-deterministic-execution-engine.md) event style.

**Explain:** What changed? Why? Who needs to know? What is affected?

---

## Schedule events / history

Scheduling is **event-backed** (examples):

`TASK_SCHEDULED`; `TASK_RESCHEDULED`; `TASK_UNSCHEDULED`; `CREW_ASSIGNED`; `CREW_REASSIGNED`; `CUSTOMER_AVAILABILITY_ADDED` / `CHANGED`; `CUSTOMER_ACCESS_CONFIRMED`; `MATERIAL_DELAY_RECORDED`; `PERMIT_DELAY_RECORDED`; `SCHEDULE_CONFLICT_DETECTED`; `SCHEDULE_OVERRIDE_APPROVED`; `INSPECTION_SCHEDULED` / `RESCHEDULED`.

**Purposes:** Audit; explain timeline changes; feed **Work Station**; customer comms history; analytics later.

---

## Customer view of schedule

Filtered projection ([08](./08-customer-view.md)):

**May see:** Site visit scheduled; installation scheduled; inspection pending; appointment **window**; crew arrival window if policy allows; reschedule request; confirm access request.

**Should not see (typical):** Internal crew double-book; margin; supplier cost; raw worker availability grid.

**Portal actions (examples):** Confirm appointment; request reschedule; provide access instructions; upload required photos; acknowledge arrival window.

---

## Sales / quote schedule assumptions

**Before sold:** scheduling is mostly **assumptions** and **promises**—earliest likely window, permit timing assumptions, lead times, availability **notes** ([12](./12-quote-authoring-ux-and-readiness.md)).

**Canon:** Do **not** treat quote **assumptions** as a **firm confirmed** crew booking unless explicitly **booked** as such (product policy). **Actual** crew scheduling usually follows **acceptance/signature**, **deposit** if required, and clearer **dependency** facts.

---

## Conflicts and overrides

**Conflict types (examples):** Crew double-booked; individual unavailable; customer unavailable; material not ready; permit missing; payment gate missing; **dependency** incomplete; impossible travel; **skill/license** mismatch; equipment unavailable; address missing; access unknown.

**Overrides:** Managers may override certain blockers **if allowed**.

**Override records:** Who; what was overridden; **reason**; **risk**; time; customer notified?  

**Canon:** Overrides **do not erase** the underlying blocker fact—they mark **intentionally overridden** so audits and explanations stay honest.

---

## Mobile / field scheduling

**Field workers:** Today’s **route/schedule**; assigned tasks; address; access notes; required proof; blockers; **next stop**; mark arrived/started/completed; report delay. **Full global calendar** optional—often **not** needed.

**Crew leads:** Crew **day**; team assignments; delays; route order; request reschedule or **escalate** blocker.

---

## Worked example: EV charger scheduling

**Sold** EV charger job. Tasks: submit permit; order materials; **schedule install**; install; schedule final inspection; closeout.

**Facts:** Customer available Tue/Wed mornings; **Crew A** available Wednesday; **permit approved**; **breaker received**; **payment gate** satisfied; install **~3 hours**.

**Recommendation:** Wednesday **8:00–11:00**, Crew A.  
**Explain:** Crew + customer + permit + material + payment + duration.

**If breaker not received:** Wednesday → **at risk** or **blocked** per company template.

**If customer unavailable:** Update availability request; install scheduling → **waiting**.

**If inspection fails:** Correction tasks; **reinspection** scheduled after corrections ([04](./04-stages-tasks-outcomes.md) outcomes).

---

## Deterministic rule examples

| Rule | Effect |
|------|--------|
| Required material not received | Install **blocked** or **at-risk** per template policy. |
| Customer availability required but missing | Schedule task **waiting** on customer. |
| Payment gate unsatisfied | Install **cannot schedule** or **blocked** on calendar per policy. |
| Permit not approved | Install **cannot schedule** unless **tentative** allowed. |
| Crew lacks required skill/license | **Do not recommend** that crew. |
| Upstream dependency incomplete | Downstream event **blocked** or not schedulable. |
| Task scheduled, then dependency fails | Item becomes **at-risk/blocked**; **Work Station** surfaces it. |

Same **facts + rules** → same **derived** schedule readiness labels ([05](./05-deterministic-execution-engine.md)).

---

## Calendar vs Work Station relationship (summary)

| Question | Primary surface |
|----------|-----------------|
| What should I **do** right now? | **Work Station** (feeds + actions) |
| **When** is it happening? Who is **where**? | **Calendar** / Schedule **lens** |
| **Why** is this slot risky or invalid? | **Scheduling layer** + explanations in Work Station / job |

They share **one** schedule and readiness **model**; different **emphasis**.

---

## Assumptions (not canon)

- Exact **calendar UI** and drag-drop behavior not decided.  
- **Global calendar** may live under Work Station, Jobs, or both.  
- **Work Station Schedule tab** exists **conceptually** in canon.  
- Some companies allow **tentative** scheduling; others require **hard** readiness first—**template/company** configurable.  
- **Route optimization** and **weather** integration are **future-facing**.  
- **Existing code** may not yet match this model.

---

## Implementation later

- Map canon to **current** calendar/schedule code.  
- **Schedulable object** model; **availability window** model; **schedule readiness** enum or derived labels.  
- **Schedule event** catalog and idempotency.  
- **Reschedule** workflow; customer **appointment confirmation**.  
- **Crew/resource** calendar APIs.  
- **Tentative vs confirmed** scheduling semantics.  
- **Override** permissions and UI.  
- **Work Station** schedule queries; **customer portal** schedule projection.  
- **Global calendar** vs Work Station Schedule tab **routing**.  
- **Mobile** field schedule UX.
