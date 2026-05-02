# Struxient v4 Requests, Messages, and Notifications

## Purpose

Define how Struxient handles **requests** (structured asks), **messages** (conversation context), and **notifications** (surfacing). Aligns with [Work Station MVP](../work-station/struxient-v4-work-station-mvp.md) **Requests** tab and **context rail** ([app-shell 02](../app-shell/02-work-station-surface.md)).

**CANON:** **Notifications** point to **tasks/requests/events**—they are **not** the sole source of truth. **Requests** can become **Work Station cards**.

---

## Definitions

| Term | Meaning |
|------|---------|
| **Request** | Structured item needing **action** from someone (customer upload, manager approval, confirm window). |
| **Message** | Thread/comment content for humans (internal or customer-visible). |
| **Notification** | Mechanism that **alerts** a user (in-app, email, SMS later). |

---

## Request types (examples)

- Customer: upload panel photo.  
- Manager: approve low-margin quote.  
- Customer: confirm install window.  
- Customer: approve change order (later).  
- Office: respond to AHJ correction (internal request card).

---

## Messages / comments

- **Internal** on task/job for crew/office.  
- **Customer-visible** with moderation rules ([08](../execution-workflow/08-customer-view.md)).

---

## Notifications (examples)

- Crew: install **rescheduled**.  
- Office: customer **uploaded files**.  
- Sales: quote **viewed** (if tracked).

---

## Unread counts / badges

May feed **app-shell** nav badges ([app-shell 06](../app-shell/06-open-app-shell-questions.md))—policy to avoid alert fatigue.

---

## Work Station Requests tab

Lists **open requests** across jobs/quotes with deep links; complements **Task Feed**.

---

## Context rail messages

Preview last message or open request; link to full thread.

---

## Channels (future)

Email/SMS/push—**implementation later**; must not bypass authorization.

---

## Request lifecycle (conceptual)

Created → assigned/visible → completed/canceled → archived; events for analytics.

---

## Notification events (examples)

`NOTIFICATION_SENT`; `REQUEST_CREATED`; `REQUEST_COMPLETED` (implementation names TBD).

---

## Open questions

- Email as source of truth vs in-app only?  
- Customer reply-by-email ingestion?

---

## Implementation later

- Digest emails; per-user mute; SLA on requests.

---

*Planning canon only.*
