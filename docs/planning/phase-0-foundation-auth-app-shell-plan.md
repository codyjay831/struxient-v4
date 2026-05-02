# Phase 0 — Foundation, Auth, App Shell (Implementation Plan)

## Purpose

This document is the **detailed implementation plan for Phase 0 only**: foundation, authentication, **tenant/org** model, **protected internal app shell**, **left navigation**, **dark UI system**, **placeholders**, and **baseline planning** for events/audit. It will be **reviewed before any code is written**.

**Mode:** Planning only. **No** code, app files, schema, migrations, packages, or runtime behavior changes are made by authoring this document.

**Upstream plans:**

- [struxient-v4-full-phase-implementation-plan.md](./struxient-v4-full-phase-implementation-plan.md) — Phase 0 definition, handoff rules, global principles  
- [struxient-v4-clean-slate-implementation-blueprint.md](./struxient-v4-clean-slate-implementation-blueprint.md) — vertical slice context, early routes, security posture  

**Canon / architecture references:**

- [app-shell](../architecture/app-shell/README.md) — navigation, Work Station, auth/portal model  
- [01-left-navigation-model](../architecture/app-shell/01-left-navigation-model.md)  
- [02-work-station-surface](../architecture/app-shell/02-work-station-surface.md)  
- [03-role-based-navigation-and-visibility](../architecture/app-shell/03-role-based-navigation-and-visibility.md)  
- [04-login-auth-and-portal-model](../architecture/app-shell/04-login-auth-and-portal-model.md)  
- [struxient-v4-permissions-matrix](../architecture/security/struxient-v4-permissions-matrix.md)  
- [struxient-v4-entity-map](../architecture/data-model/struxient-v4-entity-map.md)  
- [execution-workflow README](../architecture/execution-workflow/README.md) — product context (no Phase 0 feature work)

---

## 1. Phase 0 goal

Deliver a **production-minded foundation** for Struxient v4:

- Runnable app locally with **build/lint** passing.  
- **Authentication** with **session** strategy chosen and **documented**.  
- **Organization (tenant)** and **user membership** modeled conceptually and implemented minimally enough that **every future query** can scope by tenant.  
- **Protected** `/app` tree: unauthenticated users **cannot** access internal routes.  
- **App shell**: left nav (canonical items), **Work Station** as primary landing with **placeholder** content, **Admin** and **Settings** placeholders.  
- **Dark-only** UI baseline (**shadcn/ui** + **Tailwind** + **lucide-react**), **sharp** radius, **professional** look.  
- **No** customer, opportunity, quote, job, real Work Station feed, catalog, FlowSpec, portal, scheduling, or finance features—**explicitly deferred** to later phases.

**Outcome:** The app is a **secure frame** ready for Phase 1 data.

---

## 2. Source canon references

| Topic | Document |
|-------|----------|
| Left nav spine, Work Station as hub | [app-shell 01](../architecture/app-shell/01-left-navigation-model.md), [02](../architecture/app-shell/02-work-station-surface.md) |
| Default landing, role-aware direction | [app-shell 03](../architecture/app-shell/03-role-based-navigation-and-visibility.md) |
| Internal auth, tenant, routing chain | [app-shell 04](../architecture/app-shell/04-login-auth-and-portal-model.md) |
| Server-side permission principle | [security permissions matrix](../architecture/security/struxient-v4-permissions-matrix.md) |
| Conceptual entities for org/user/membership | [data-model entity map](../architecture/data-model/struxient-v4-entity-map.md) |
| Phase ordering, “one phase at a time” | [full-phase plan](./struxient-v4-full-phase-implementation-plan.md) — Implementation rule |

---

## 3. Current workspace state

**Audited at planning time (Struxient v4 repo snapshot):**

| Item | Present? | Notes |
|------|----------|--------|
| **Docs-only repo** | **Yes** — application source under this workspace path appears **documentation-only** (`docs/**`). | No `package.json`, `app/`, `src/`, or Prisma files found at repo root in snapshot. |
| **`package.json`** | **No** | Must be created when implementation starts (e.g. `create-next-app` or manual). |
| **Next.js app** | **No** | **Initialize** Next.js (App Router) during Phase 0 implementation. |
| **Prisma schema** | **No** | **Plan** in this doc only; **create** `schema.prisma` during implementation after review—not in this planning pass. |
| **Tailwind / shadcn** | **No** | **Add** during implementation: Tailwind v4 or v3 per Next template; `shadcn-ui` init per docs. |

**What must be initialized during implementation (after this plan is approved):**

1. Next.js **App Router** + **TypeScript** project in repo (or agreed subdirectory).  
2. **Tailwind CSS** + **shadcn/ui** + **lucide-react**.  
3. **Prisma** + **PostgreSQL** (local Docker, cloud dev DB, or Neon—**open decision** §18).  
4. **Auth** library integration (Auth.js / NextAuth or alternative—**open decision** §18).  
5. **Environment** template (`.env.example`) for `DATABASE_URL`, `AUTH_SECRET`, etc.—**no secrets in repo**.

If the repo later contains code outside this snapshot path, **re-audit** section 3 before coding.

---

## 4. Proposed stack for Phase 0

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **Next.js** (App Router) | Matches full-phase plan; SSR/middleware for auth boundaries. |
| Language | **TypeScript** | Type-safe server actions and shared DTOs. |
| ORM | **Prisma** | Matches clean-slate blueprint; migrations in **implementation**, not this doc. |
| Database | **PostgreSQL** | Standard relational fit for tenant + membership + future workflow. |
| Auth | **Auth.js (NextAuth v5)** or **Clerk** / **WorkOS** — **decide in §18** | Session-based internal login; avoid rolling crypto. |
| UI | **shadcn/ui** + **Tailwind** | Accessible primitives; dark theme control. |
| Icons | **lucide-react** | Consistent with canon UI direction. |
| Theme | **Dark mode only** (locked) | No theme toggle in Phase 0 to reduce scope; light mode later if ever. |
| Env | **Production-safe**: `AUTH_SECRET`, `DATABASE_URL`, no defaults in committed `.env` | Use `.env.example` + secrets manager in prod. |

**Principle:** No **client-trusted** `organizationId`; resolve tenant from **session + membership** on server ([security](../architecture/security/struxient-v4-permissions-matrix.md), [app-shell 04](../architecture/app-shell/04-login-auth-and-portal-model.md)).

---

## 5. Phase 0 route plan

### Internal routes (first implementation)

| Route | Purpose |
|-------|---------|
| `/login` | Staff sign-in; unauthenticated entry. |
| `/app` | **Redirect** → `/app/work-station` (no standalone dashboard in Phase 0). |
| `/app/work-station` | Default home; **placeholder** shell per §10. |
| `/app/admin` | **Placeholder** for future users/org config. |
| `/app/settings` | **Placeholder** for user prefs. |

### Redirect / guard behavior

| Condition | Behavior |
|-----------|----------|
| User visits `/app/*` **without** valid session | **Redirect** to `/login` (middleware or layout server check—**server-enforced**). |
| User visits `/login` **with** valid session | **Redirect** to `/app/work-station`. |
| User visits `/app` (authenticated) | **Redirect** to `/app/work-station`. |

### Optional (implementation choice)

- `/` → marketing stub or redirect to `/login` for Phase 0; document choice in phase kickoff.

### Not in Phase 0

- `/portal/*` — Phase 7.  
- `/app/sales/*`, `/app/customers/*`, etc. — **disabled** or absent; nav may show **disabled** items without registering routes that leak data (§8).

---

## 6. Phase 0 conceptual models

**No Prisma schema here** — field lists are **conceptual** for review.

### Organization / Tenant

| | |
|--|--|
| **Purpose** | Multi-tenant boundary; every business row belongs to one org. |
| **Key fields (conceptual)** | `id`, `name`, `slug` (optional), `createdAt` |
| **Relationships** | 1→N `Membership`; future: customers, quotes, jobs |
| **Phase 0 need** | **Yes** — at least one org for dev seed. |
| **Later expansion** | Billing plan, branding, SSO domain, feature flags |

### User

| | |
|--|--|
| **Purpose** | Human identity (login subject). |
| **Key fields** | `id`, `email`, `name`, `passwordHash` (if credentials) or `externalId` (if OAuth), `createdAt` |
| **Relationships** | N→N org via `Membership` |
| **Phase 0 need** | **Yes** — seed admin/dev user. |
| **Later expansion** | MFA, avatar, invited status |

### Membership

| | |
|--|--|
| **Purpose** | User’s role **within** an organization. |
| **Key fields** | `id`, `userId`, `organizationId`, `role` (enum or FK to `Role`) |
| **Relationships** | M:N bridge between User and Organization |
| **Phase 0 need** | **Yes** — tenant resolution = “memberships for session user, pick current org”. |
| **Later expansion** | Multiple orgs per user; `lastSelectedOrganizationId` in session/profile |

### Role

| | |
|--|--|
| **Purpose** | Named bundle of permissions (Owner, Admin, …). |
| **Key fields** | `id`, `key` (`OWNER`, `ADMIN`, `MEMBER`), `name` |
| **Relationships** | Referenced by `Membership` (enum on membership **or** FK—open §18) |
| **Phase 0 need** | **Minimal** — e.g. `OWNER` for seed user. |
| **Later expansion** | Full matrix from [permissions matrix](../architecture/security/struxient-v4-permissions-matrix.md) |

### Permission

| | |
|--|--|
| **Purpose** | Fine-grained capability (optional in Phase 0). |
| **Key fields** | `id`, `key` (e.g. `app.access`) |
| **Relationships** | Role ↔ Permission many-to-many **later** |
| **Phase 0 need** | **Optional** — can start with **role enum only** + hardcoded checks for `OWNER`. |
| **Later expansion** | DB-driven permissions, Admin UI |

### AuditEvent / AppEvent (baseline)

| | |
|--|--|
| **Purpose** | Append-only trail for security and future “why changed” ([execution-workflow 05](../architecture/execution-workflow/05-deterministic-execution-engine.md) spirit). |
| **Key fields** | `id`, `organizationId`, `actorUserId`, `type` (e.g. `USER_LOGIN`, `SESSION_STARTED`), `payload` (JSON, small), `createdAt` |
| **Relationships** | Optional FK to user/org |
| **Phase 0 need** | **Conceptual minimum** — table **may** be created in Phase 0 **or** deferred to start of Phase 1; **do not overbuild** (§13). |
| **Later expansion** | Quote/job event types; export; retention policy |

---

## 7. Auth and tenant strategy

### Login flow (internal)

1. User opens `/login`.  
2. Submits credentials (email/password) **or** OAuth button (if chosen in §18).  
3. Server validates → creates **session** (cookie strategy per Auth.js / provider).  
4. Redirect to `/app/work-station`.

### Session strategy

- **Prefer** httpOnly, Secure, SameSite cookies via Auth.js session adapter.  
- Session payload contains **user id** and **current organization id** only if **server-validated** on each request (re-load membership from DB where practical—avoid stale role escalation).

### AUTH_SECRET, stale JWT cookies, and middleware (Phase 0 implementation note)

- **Canonical env var:** `AUTH_SECRET` (Auth.js v5). `NEXTAUTH_SECRET` exists only as a **temporary fallback** while migrating env files from NextAuth v4; do **not** set both to different values.  
- **Stability:** Generate once per environment (`openssl rand -base64 32`), commit **only** `.env.example`, and keep `.env` local.  
- **After rotating `AUTH_SECRET`:** existing encrypted session cookies can no longer be decrypted (`JWTSessionError` / “no matching decryption secret” in logs). **Clear cookies / site data** for the origin (e.g. `localhost`), restart the dev server, and optionally delete **`.next`** if caches look stale.  
- **Middleware vs RSC:** Auth.js may emit `Set-Cookie` to clear broken cookies on session fetch. Middleware must run on **`/login`** and **`/`** as well as **`/app/*`** so those headers reach the browser; relying on RSC `auth()` alone is insufficient because it does not forward session response cookies.  
- **Blank `AUTH_SECRET`:** an empty string in config must be avoided—it blocks Auth.js’s inference fallback to `NEXTAUTH_SECRET`. The app resolves the secret via a shared helper that trims and rejects empty values.

### Tenant resolution

1. After auth, determine **currentOrganizationId**:  
   - **Phase 0 simple rule:** single membership → use it; multiple → use last-selected (stored in session or user preference table **later**).  
2. **Every** server action / data query: `where: { organizationId: ctx.organizationId }`.  
3. **Never** accept raw `organizationId` from client body as authority—**optional** client hint for UX only, **always** verify membership server-side.

### Membership and role lookup

- On request: `findFirst` membership for `(userId, organizationId)`.  
- If missing → **403** or redirect to “no org” error page (minimal in Phase 0).

### Protected route guard

- **Middleware** (Edge) for cookie presence + optional JWT decode **or** **layout** server component that calls `auth()` and redirects—**team picks one pattern**; both must end in same security guarantees.  
- **Server Components** default; **no** sensitive data in client-only pages without guard.

### Unauthorized behavior

- Navigate to `/app/*` without session → **302** `/login`.  
- API/route handler without session → **401/403** JSON or redirect per convention.

### Seed / admin user strategy

- **Seed script** (Prisma) or **migration seed**: create `Organization` “Struxient Dev”, `User` admin@…, `Membership` with OWNER.  
- **Document** default password in **private** dev doc or one-time setup CLI—**never** commit real passwords.

### Dev-login option (if needed)

- **Optional:** magic dev button on `/login` **only** when `NODE_ENV=development` **and** `ENABLE_DEV_LOGIN=true` in env **explicitly set**.  
- **Must not** ship to production builds; CI should fail if dev flag enabled in prod config.  
- **Avoid** making dev-login the **only** path—real auth should work early.

### Security requirements (checklist)

- [ ] **No client-trusted tenant IDs** for authorization.  
- [ ] **Server-side** permission checks on any Phase 0 “admin” stub if it mutates anything.  
- [ ] **Secure env**: `AUTH_SECRET`, database URL from env; validate at startup.  
- [ ] **Tenant isolation** on every DB read/write introduced in Phase 0.  
- [ ] **No** “open” `/app` in production without session—even for “empty” pages.

---

## 8. App shell plan

### Root internal layout

- Path group: `app/(auth)/login` vs `app/(app)/app/...` (exact grouping **open** §18).  
- **`(app)` layout**: flex row — **left nav** fixed width; **main** scrollable; optional **top bar**.

### Left nav — canonical items ([app-shell 01](../architecture/app-shell/01-left-navigation-model.md))

| Nav item | Phase 0 behavior |
|----------|-------------------|
| **Work Station** | **Active** — links to `/app/work-station`. |
| **Admin** | **Active** as **placeholder** — `/app/admin`. |
| **Settings** | **Active** as **placeholder** — `/app/settings`. |
| **FlowSpec Builder** | **Disabled** or “Coming soon” — **no route** or static page without data. |
| **Jobs** | **Disabled** |
| **Customers** | **Disabled** |
| **Sales** | **Disabled** |
| **Finance** | **Disabled** |
| **Catalog** | **Disabled** |

**Implementation choice:** Disabled items either **non-clickable** (`aria-disabled`) with tooltip, or link to same placeholder with copy “Available in Phase X”. **Must not** hit APIs for future modules.

### Header / top bar (optional)

- **Minimal:** org name + user email + **Logout**.  
- **Logout:** server action or Auth.js signOut → `/login`.

### User / tenant display

- Show **current organization name** and **user name/email** from **server-derived** session context (props from layout loader).

### Layout responsiveness

- **Desktop-first** contractor UX; nav collapses to **icon rail** or **drawer** on small screens (implementation detail—must not drop auth).

---

## 9. UI system plan

| Decision | Spec |
|----------|------|
| Mode | **Dark only** — no light toggle Phase 0. |
| Background | **Near-black** primary background (`bg-zinc-950` or similar). |
| Accent | **Blue** accent for primary buttons/links (single accent family). |
| Radius | **Sharp / tight** — `rounded-sm` or `rounded-md` max for cards/buttons. |
| Components | **shadcn/ui** primitives; customize theme tokens in `globals.css` / CSS variables. |
| Icons | **lucide-react** only for nav and placeholders. |
| Style | **Professional**, dense, **no** playful illustration overload. |
| Accessibility | WCAG-minded contrast for text on black; focus rings visible. |

Document **theme tokens** in implementation README when coding starts.

---

## 10. Work Station placeholder

**Content goals:**

- Title: **Work Station**  
- Short paragraph: *Actionable work feed arrives in Phase 5. Phase 0 establishes auth, tenant, and navigation.*  
- **Badge or label:** “Phase 0 shell ready”  
- **Disabled preview** of future feed sections (non-interactive, no backend):  
  - **Now**  
  - **Blocked**  
  - **Waiting**  
  - **Needs Review**  
  - **Scheduled**  
- Optional: link to internal planning doc (only if acceptable for dev build—not required in prod).

**Must not:** Fetch real tasks or show fake customer data.

---

## 11. Admin placeholder

- Heading: **Admin**  
- Copy: *User management, roles, company settings, and integrations will live here (later phases).*  
- **No** user table CRUD required in Phase 0 unless seeding demands a **read-only** “you are owner” display.  
- If a **list users** stub is tempting—**defer** to avoid overbuilding (§19).

---

## 12. Settings placeholder

- Heading: **Settings**  
- Copy: *Profile and preferences will live here. Dark mode is locked for Phase 0.*  
- Optional: display read-only **email** from session.  
- **No** notification prefs, API keys, or org branding yet.

---

## 13. Events / audit baseline

**Recommendation for Phase 0:**

- **Plan** `AuditEvent` / `AppEvent` table and 2–3 event types (`USER_LOGIN`, `USER_LOGOUT`, `ORG_CREATED` if applicable).  
- **Implement minimally** if low cost with Prisma; **otherwise** defer **writes** to Phase 1 but **reserve** table name in schema sketch during implementation review.

**Do not:** Build full audit UI, filters, or export in Phase 0.

---

## 14. Implementation sequence (for the later coding phase)

Ordered steps—**execute only after this plan is approved**:

1. **Initialize** Next.js App Router + TypeScript (if repo empty).  
2. **Install** dependencies: Tailwind, shadcn/ui, lucide-react, Prisma, auth library, bcrypt or adapter as needed.  
3. **Configure** Tailwind + **shadcn** init + **dark** CSS variables.  
4. **Add** Prisma + PostgreSQL connection; **create** initial schema **only** for Org/User/Membership/Role (as decided)—migrations in implementation.  
5. **Implement** auth: providers, session, callbacks, **session includes org**.  
6. **Add** middleware or layout guard for `/app/*`.  
7. **Create** `(app)` layout: left nav + header + `children`.  
8. **Create** routes: `/login`, `/app` redirect, `/app/work-station`, `/app/admin`, `/app/settings`.  
9. **Wire** nav: active vs disabled items.  
10. **Seed** dev org + admin user + membership.  
11. **Run** `pnpm build` / `npm run build`, `lint`, fix issues.  
12. **Verify** acceptance criteria (§16) manually + any smoke test added.

---

## 15. Testing and verification plan

| Check | How |
|-------|-----|
| App starts | `pnpm dev` / `npm run dev` |
| Build passes | `pnpm build` |
| Lint passes | `pnpm lint` |
| Unauthenticated `/app` | Browser incognito → expect redirect to `/login` |
| Login | Valid seed user → lands on `/app/work-station` |
| Authenticated `/login` | Redirect to `/app/work-station` |
| Nav renders | All canonical labels visible; disabled items not navigable to sensitive data |
| Disabled routes | No API returns customer/quote/job data (routes may 404 or show “coming soon” without DB) |
| Tenant/role server-derived | Inspect server logs or debug: `organizationId` from membership, not from client param |

**Automated (when test harness exists):** Playwright or Vitest for redirect + login smoke.

---

## 16. Acceptance criteria

- [ ] App runs locally with documented env vars.  
- [ ] **`/login`** exists and is the entry for unauthenticated users.  
- [ ] **`/app/*`** requires authentication; unauthenticated access **redirects** to `/login`.  
- [ ] Authenticated user landing **`/app`** goes to **`/app/work-station`**.  
- [ ] **Left nav** renders with **Work Station**, **Admin**, **Settings** usable; other items **disabled** or non-data-stub.  
- [ ] **Tenant** and **user** context visible from **server-derived** data.  
- [ ] **Logout** returns to `/login`.  
- [ ] **Dark-only** UI with **black** base and **blue** accent, **tight** radius, **shadcn** + **lucide**.  
- [ ] **Build** and **lint** pass in CI/local.  
- [ ] **No** Phase 1+ business entities required to satisfy above.

---

## 17. Explicitly out of scope

Customers, opportunities, quotes, jobs, **real** Work Station feed, catalog, FlowSpec, customer portal, scheduling, finance, change orders, evidence/uploads product, requests/messages/notifications, outcome rules, payment gates, **production** SSO (unless chosen as Phase 0—unlikely), full Admin CRUD.

---

## 18. Open decisions before coding

| Decision | Options / notes |
|----------|-----------------|
| **Auth library** | **Auth.js (NextAuth v5)** vs **Clerk** vs **WorkOS** vs **Supabase Auth** — pick based on time-to-market vs control. |
| **First local login** | Real email/password vs **dev-login** env flag — prefer **real** early; dev-login optional. |
| **Database hosting** | Local Docker Postgres vs Neon/Supabase — affects connection string and SSL. |
| **Seed strategy** | Prisma `seed.ts` vs standalone script; reset DB policy for dev. |
| **Route grouping** | `(marketing)` / `(auth)` / `(app)` conventions; where to put `middleware.ts`. |
| **Role model** | Enum on `Membership.role` vs `Role` table vs string constants in code for Phase 0 only. |
| **Audit table** | Create in Phase 0 vs stub interface only — decide after effort estimate. |
| **Single vs multi-org per user** | Phase 0 can force **single org** for all dev users to reduce picker UI. |

---

## 19. Risks and drift warnings

| Risk | Mitigation |
|------|------------|
| **Insecure auth shortcut** becomes permanent | Code review + **no** dev-login in prod; feature flag removed from prod builds. |
| **Weak tenant isolation** | PR checklist: every query includes `organizationId` from **session membership**. |
| **Overbuilding Admin** | Placeholder only; no user management UI until dedicated phase. |
| **Skipping shell** to build quote/customer | **Forbidden** until Phase 0 acceptance signed off ([full-phase plan](./struxient-v4-full-phase-implementation-plan.md)). |
| **UI drift** from Struxient v4 dark/sharp style | Lock tokens in `globals.css`; design review screenshot gate for Phase 0 PR. |

---

*Phase 0 implementation planning only. No code, schema, migrations, packages, or runtime behavior was changed by creating this file.*
