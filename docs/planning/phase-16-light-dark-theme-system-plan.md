# Phase 16 — Built-in Light / Dark / System Theme System (Planning / Recon)

**Mode:** Planning and recon only. No implementation in this phase.  
**Product goal:** Add durable theme infrastructure (Light, Dark, System) while keeping **Dark** the premium default and enabling a **professional light mode** without inverting the product into a “cheap” theme.

---

## 1. Verdict / recommended MVP

**Recommended path:** **Option A — `next-themes` + semantic token MVP** (with deliberate follow-up for status chroma).

| Decision | Recommendation |
|----------|----------------|
| Use `next-themes` in Phase 16 implementation? | **Yes** — best fit for Next.js App Router, class-based dark mode already configured, three-way `light` / `dark` / `system`, local persistence, and documented hydration patterns. |
| Default when no preference exists | **`dark`** — matches product canon and current visual baseline. |
| Modes in MVP | **`light`, `dark`, `system`** — `system` maps to `prefers-color-scheme` via `next-themes`; scope is small once provider is correct. |
| Preference storage | **Local only** (`localStorage` via `next-themes`, default storage key). **No schema / DB** in MVP unless recon later shows zero-cost reuse of an existing user-prefs model (none found). |
| Customer portal | **Include in the same CSS token system** (portal already uses semantic Tailwind classes). **Do not** add portal-visible theme controls or “customer theme customization.” Ensure **staff-only** theme UI lives only under authenticated app chrome (`AppShell` / staff routes), not under `/portal/*`. |
| Forced `dark` on `<html>` today | **Remove the hard-coded `className="dark"`** when implementing, and replace with **`ThemeProvider`** driving `class` (or `attribute="class"`) — while **defaulting** theme to `dark` so first paint intent stays premium dark. |
| Surface conversion | **Targeted**, not wholesale: (1) **globals.css** — introduce a real **light** `:root` palette and move current values to **`.dark`** (Shadcn-canonical structure) or equivalent; (2) **root layout** — provider + no static theme class; (3) **high-impact hard-coded surfaces** (zinc dialog shells, `shadow-black`, dialog overlay); (4) **status / readiness** — minimum viable pass so light backgrounds do not use `text-emerald-100` / `text-amber-100` without adjustment. |
| Theme toggle placement | **Staff app header** (`AppHeader`) — minimal, always visible to authenticated users, does not require new routes or settings pages. Alternative deferred: command surface / dedicated settings page. |
| Schema migration | **None** for recommended MVP. |
| Route changes | **None required** — theme is global UI concern. |

**Safe to prompt implementation next?** **Yes**, with the explicit **non-goals** and **status-color** follow-up scope below. No architectural blocker; main work is **CSS variable split**, **provider wiring**, and **targeted class cleanup**.

**Blockers / unknowns:** None technical. **Unknown:** exact light palette acceptance (subjective); mitigate with a short **design QA** pass on real pages after token split.

---

## 2. Files inspected

| Area | Path |
|------|------|
| Tailwind | `tailwind.config.ts` |
| Global CSS / tokens | `src/app/globals.css` |
| Root layout | `src/app/layout.tsx` |
| Authenticated app layout | `src/app/(app)/app/layout.tsx` |
| Providers | `src/components/providers/app-providers.tsx` |
| App shell | `src/components/app-shell/app-shell.tsx`, `app-sidebar.tsx`, `app-header.tsx` |
| shadcn config | `components.json` |
| UI primitives | `src/components/ui/button.tsx`, `card.tsx`, `dialog.tsx`, (+ `input`, `label`, `textarea`, `separator`, `tooltip`) |
| `cn` utility | `src/lib/utils.ts` |
| Work Station | `src/app/(app)/app/work-station/page.tsx`, `work-station-feed-ui.tsx` |
| Schedule | `src/app/(app)/app/schedule/page.tsx`, `src/lib/schedule-readiness-ui.ts` |
| Quote workspace (sample) | `src/app/(app)/app/sales/quotes/[quoteId]/quote-workspace.tsx`, `quote-work-template-ui.tsx` |
| Templates library | `src/app/(app)/app/sales/templates/templates-library-client.tsx` |
| Jobs (sample) | `src/app/(app)/app/jobs/[jobId]/page.tsx`, `job-task-status-form.tsx` |
| Portal | `src/app/portal/[token]/page.tsx`, `portal-customer-view.tsx` |
| Auth | `src/app/(auth)/login/page.tsx` |
| Dependencies | `package.json` |
| Tests (inventory) | `src/server/**/__tests__/**/*.test.ts` (Vitest; server-focused) |

---

## 3. Current theme / styling foundation

### 3.1 Tailwind (`tailwind.config.ts`)

- **`darkMode: ["class"]`** — class-based dark mode is **already enabled**; this aligns with `next-themes` and Shadcn conventions.
- **`theme.extend.colors`** maps Shadcn semantic names to **`hsl(var(--token))`**: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`.
- **Radius** tokens wired via `--radius`.

### 3.2 Global CSS (`src/app/globals.css`)

- **Single `@layer base` block** with **only `:root`** defining CSS variables.
- Variable values are **numerically “dark UI”** (e.g. `--background: 240 6% 4%`, low luminance surfaces). There is **no** separate **light** `:root` palette and **no** `.dark { ... }` override block in this file.
- **`body`** uses `@apply bg-background text-foreground antialiased` — good semantic baseline.

**Implication:** The codebase uses **semantic token names**, but **today there is only one concrete palette** in CSS. Light mode is not yet a first-class second palette; adding it requires **splitting** variables into **light `:root`** + **dark `.dark`** (or equivalent), not sprinkling random `bg-white` across the app.

### 3.3 shadcn / components.json

- **`components.json`** indicates **Shadcn “new-york”**, **`cssVariables: true`**, **`baseColor: "zinc"`**, CSS path `src/app/globals.css`.
- Confirms intended direction: **token-driven** UI.

---

## 4. Current provider / layout structure

### 4.1 Root layout (`src/app/layout.tsx`)

- Imports **`globals.css`** and wraps children in **`AppProviders`**.
- **`<html lang="en" className="dark" suppressHydrationWarning>`** — theme is **hard-forced to dark** at the document root.
- **`<body>`** applies font variables and `min-h-screen font-sans` only (no explicit bg; inherits from `body` rule in globals).

### 4.2 `AppProviders` (`src/components/providers/app-providers.tsx`)

- **Client component** wrapping **`SessionProvider`** from `next-auth/react` only.
- **No** `ThemeProvider`, no appearance context.

### 4.3 Authenticated shell (`src/app/(app)/app/layout.tsx` → `AppShell`)

- **`AppShell`** (`app-shell.tsx`) uses **`bg-background`**, **`border-border`**, semantic text — **shell is largely token-aligned**.
- **`AppSidebar` / `AppHeader`** use **`bg-card/30`**, **`bg-card/40`**, **`text-foreground`**, **`text-muted-foreground`** — token-friendly.

**Implication:** Provider work is **localized**: add a theme provider next to (inside or outside) `SessionProvider` per `next-themes` + Next 15 guidance, and **stop** hard-coding `dark` on `<html>` once the provider owns the class.

---

## 5. Hard-coded dark class audit (representative, not exhaustive)

### 5.1 Forced document theme

| Location | Pattern | Severity |
|----------|---------|----------|
| `src/app/layout.tsx` | `className="dark"` on `<html>` | **Critical** for any real theme switching; must change when implementing. |

### 5.2 Zinc / near-black surfaces (theme-breaking in light mode)

| File | Pattern |
|------|---------|
| `src/app/(app)/app/sales/quotes/[quoteId]/quote-work-template-ui.tsx` | `DialogContent` / panels: `bg-zinc-950`, `bg-zinc-900/50`, `bg-zinc-900/40` |
| `src/app/(app)/app/sales/templates/templates-library-client.tsx` | `bg-zinc-900/50`, `DialogContent` `bg-zinc-950` |

**Severity:** **High** for MVP light mode — these surfaces will stay **visually dark** or clash if the rest of the page becomes light.

### 5.3 Black overlays / shadows

| File | Pattern |
|------|---------|
| `src/components/ui/dialog.tsx` | Overlay: `bg-black/70` |
| `src/app/(auth)/login/page.tsx` | Card: `shadow-black/40` |

**Severity:** **Medium** — overlay may still be acceptable; shadow on light cards may read as muddy; consider **tokenized overlay** (e.g. `bg-background/80` + backdrop) in a later polish if needed.

### 5.4 `dark:` variant usage

- Ripgrep for **`dark:`** in `src/**/*.tsx` returned **no matches** in this recon snapshot.

**Interpretation:** The app does **not** rely on Tailwind `dark:` utilities today; it assumes **one** dark-looking palette everywhere, reinforced by **`html.dark`**.

### 5.5 Inline styles / arbitrary hex

- Quick scan for **`style={{`** and **`bg-[`** did not surface broad usage beyond noted shadows; deeper pass during implementation is still wise.

---

## 6. Core surfaces impact assessment

| Surface | Token usage | MVP notes |
|---------|-------------|-----------|
| **App shell** (sidebar, header, main) | Strong: `bg-background`, `bg-card/*`, `border-border`, `text-foreground`, `text-muted-foreground` | **Low change** once global palettes exist. |
| **Work Station** (`work-station-feed-ui.tsx`) | Strong semantic usage; primary accents use `primary/*` | **Low change**; validate contrast on light `muted` / `card` surfaces. |
| **Schedule** (`schedule/page.tsx`) | Page chrome semantic; readiness badges via `readinessBadgeClassName` | **Medium** — badge colors (see §7). |
| **Quote workspace** | Mix: many semantic classes; **warnings** use `amber-*`; some panels use **zinc** in template dialogs | **High** — template dialog zinc shells are MVP conversion targets. |
| **Jobs** | Warnings / paused banners use `amber-*` heavily | **Medium** — readability on light backgrounds. |
| **Templates library** | Same zinc dialog pattern + amber callouts | **High** (same as quote templates). |
| **Customer portal** (`portal-customer-view.tsx`) | **Semantic** (`bg-background`, `bg-card/*`, `border-border`) | **Low structural change**; inherits global tokens. **No staff controls** in this file. |
| **Login** | Mostly semantic + **`shadow-black/40`** | **Low–medium**. |

---

## 7. Customer portal assessment

### 7.1 Current behavior

- **`/portal/[token]`** renders **`PortalCustomerView`** with **Card** / **Separator** and semantic utility classes (`bg-background`, `bg-card/30`, etc.).
- Portal is **not** wrapped in `AppShell`; it does **not** include staff navigation or header actions.

### 7.2 Staff control leakage

- **Risk is UI placement**, not data: a theme toggle must **not** be added to shared layouts that render portal.
- **Recommendation:** Mount the **theme control only** in **`AppHeader`** (or another **route-gated staff-only** component). **Do not** add to `portal-customer-view.tsx` or a shared `(marketing)` layout without audit.

### 7.3 Inherit vs fixed for MVP

| Approach | Assessment |
|----------|--------------|
| **Inherit global tokens** (same `globals.css`) | **Recommended for MVP** — one source of truth; light mode “works” on portal if staff/browser theme is light; **no extra schema**. |
| **Portal fixed dark** | Possible via a route-level wrapper, but **adds divergence** and maintenance (two visual baselines). Defer unless brand requires customer-only dark. |
| **Portal system-only** | Adds complexity; **defer**. |

**Product safety:** Portal remains **view-only** and **token-driven**; theme work must **not** change workflow, permissions, or DTOs.

---

## 8. Status color audit (semantic-token vs hard-coded chroma)

### 8.1 Destructive / primary / muted

- **Shadcn `destructive` / `primary` / `muted`** are used in many places (`button.tsx`, badges, blocked states) — **good** for cross-theme behavior **after** CSS variables are tuned for both themes.

### 8.2 Success / warning / schedule / evidence (hard-coded Tailwind hues)

Representative patterns:

- **`src/lib/schedule-readiness-ui.ts`** — `readinessBadgeClassName`: `emerald-*`, `amber-*`, `destructive`, `primary`, `border` / `muted` mixes.
- **`src/app/(app)/app/sales/opportunities/[opportunityId]/readiness-panel.tsx`** — `text-emerald-400`, `text-amber-400`, border mixes.
- **`src/app/(app)/app/sales/quotes/[quoteId]/quote-workspace.tsx`** — `text-amber-400`, `text-emerald-400`, amber callout boxes, `text-amber-200`.
- **`src/components/job-evidence/job-evidence-section.tsx`** — amber / emerald surface + `text-emerald-100` / `text-amber-100`.
- **Jobs** — `text-amber-100`, `text-amber-200`, `border-amber-500/*`, `bg-amber-500/10`, etc.

**Assessment:** These are **not** expressed as CSS variables today; they are **chroma tuned for dark surfaces** (e.g. `text-*-100` on deep backgrounds). On a **light** background, **the same classes may lose hierarchy or feel washed out / too neon**.

**MVP strategy (recommended):**

1. **Short term:** Introduce **semantic status tokens** in CSS, e.g. `--success`, `--success-foreground`, `--warning`, `--warning-foreground`, `--warning-border`, mapped in `tailwind.config.ts`, and **migrate the highest-traffic badge helpers first** (`readinessBadgeClassName`, job-evidence status chips, quote send headline).
2. **Or** use **paired utilities**: `text-emerald-700 dark:text-emerald-100` style pairing — works without new CSS vars but **increases `dark:` usage** and must be applied consistently.

**Recommendation:** Prefer **CSS variables for status** long-term; for **strict MVP scope**, pick **one** approach and apply to **readiness + evidence + quote send row** first (highest user trust surfaces).

---

## 9. Existing dependencies (`package.json`)

| Package | Present? | Notes |
|---------|------------|-------|
| **`next-themes`** | **No** | To be added in implementation phase (not in this planning phase). |
| **Tailwind** | **Yes** (`tailwindcss` ^3.4) | Compatible with Shadcn + class dark mode. |
| **Radix** | **dialog, label, separator, slot, tooltip** | No **dropdown-menu** / **select** yet; theme toggle can start as **two/three `Button`s` or a minimal custom popover** without new Radix primitives, or add Shadcn **DropdownMenu** when implementing. |
| **lucide-react** | **Yes** | Icons for Sun / Moon / Monitor (implementation detail). |

---

## 10. Options comparison

### Option A — `next-themes` + semantic token MVP

| Criterion | Notes |
|-----------|--------|
| Canon fit | **Strong** — explicit Light/Dark/System, dark default, professional light path via tokens. |
| Implementation risk | **Low–medium** — well-trodden for Next App Router; watch **FOUC** and **first-paint class**. |
| Schema | **None**. |
| Hydration | **Low risk** if `suppressHydrationWarning` stays on `html`, `attribute="class"`, default `dark`, and client provider boundary is correct. |
| UX quality | **High** — user control + system respect. |
| Maintainability | **High** — one provider, one token file, lintable patterns. |
| Scope | **Medium** — provider small; bulk effort is **palette split** + **targeted fixes**. |
| Testability | Provider can be smoke-tested; most validation is **visual QA** unless E2E is introduced later. |
| **Verdict** | **Recommended.** |

### Option B — CSS-only `prefers-color-scheme`

| Criterion | Notes |
|-----------|--------|
| Canon fit | **Weak** — no explicit user preference; **no** Light/Dark/System product requirement. |
| Risk | **Low** technically, **high product gap**. |
| **Verdict** | **Reject** for Phase 16 goals (needs user-selectable appearance). |

### Option C — DB-backed user appearance

| Criterion | Notes |
|-----------|--------|
| Canon fit | Nice for multi-device sync **later**. |
| Risk | **Schema**, migrations, **SSR injection** of class, auth edge cases. |
| **Verdict** | **Defer** — violates strict MVP boundary unless prefs infrastructure already exists (it does not in recon). |

### Option D — Dark-only polish

| Criterion | Notes |
|-----------|--------|
| Canon fit | Preserves dark-first but **fails** new direction (light capability). |
| **Verdict** | **Reject** as Phase 16 outcome; acceptable as **fallback** if executive decision cancels light mode. |

---

## 11. Recommended MVP boundary (summary)

**In scope**

- Add **`next-themes`** `ThemeProvider` (implementation phase).
- **`light` / `dark` / `system`**, **`defaultTheme: "dark"`**, **`attribute="class"`**, **localStorage** persistence, **no DB**.
- **Refactor `globals.css`** to canonical **light `:root` + dark `.dark`** (migrate current values into `.dark` and design light equivalents).
- **Remove** hard-coded **`className="dark"`** from root layout; provider owns class.
- **Targeted** replacement of **zinc dialog shells**, and **login shadow** where needed.
- **Staff-only** minimal theme control in **`AppHeader`** (or sidebar footer if preferred later).
- **Status color** minimum pass on **schedule readiness**, **job evidence**, **quote send / integrity** callouts (pick CSS var strategy or `dark:` pairing — commit to one).

**Out of scope (explicit)**

- Company-level branding, per-org themes, customer-selectable portal theme.
- DB migrations, Prisma models for preferences.
- Redesign every screen; “invert filter” hacks.
- New routes for settings (unless chosen later).
- Broad `dark:` sprawl without a token strategy.

---

## 12. Proposed theme / provider plan (implementation-ready outline)

1. **Dependencies (later):** add `next-themes`.
2. **Client provider module** e.g. `src/components/providers/theme-provider.tsx` wrapping `NextThemesProvider` with:
   - `attribute="class"`
   - `defaultTheme="dark"`
   - `enableSystem`
   - optional `storageKey` namespaced (`struxient-theme`) to avoid collisions.
3. **`AppProviders`:** compose `SessionProvider` + `ThemeProvider` (order per `next-themes` docs — typically theme inside/outside session is flexible; keep both client-only).
4. **`layout.tsx`:** remove static `dark` class from `<html>`; keep **`suppressHydrationWarning`** on `<html>` for theme + future compatibility.
5. **No new routes** — toggle is a client control in existing chrome.

---

## 13. Proposed design-system / token strategy

### 13.1 Core (already named in Tailwind)

Use and **tune for both themes**:

- **Surfaces:** `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`
- **Borders / inputs:** `border`, `input`, `ring`
- **Typography hierarchy:** `muted`, `muted-foreground`
- **Actions:** `primary`, `primary-foreground`, `secondary`, `accent`
- **Destructive:** `destructive`, `destructive-foreground`

### 13.2 Light mode quality guardrails

- **Backgrounds:** avoid pure `#fff` everywhere; use **slightly warm or cool neutrals** consistent with zinc scale.
- **Borders:** ensure light mode borders are **visible** without harsh 1px black lines (HSL `--border` lift).
- **Muted text:** maintain **WCAG-ish** contrast on `muted` surfaces (validate `muted-foreground` vs `card` / `muted`).

### 13.3 Status / warning / success (extension)

Add **semantic CSS variables** (names illustrative):

- `--success`, `--success-foreground`, `--on-success` (as needed)
- `--warning`, `--warning-foreground`
- Optional: `--info` if used later

Map in `tailwind.config.ts` under `extend.colors` (e.g. `success: "hsl(var(--success))"`) and migrate **central helpers** first (`readinessBadgeClassName`, shared badge components).

### 13.4 Focus / accessibility

- Preserve **`ring` / `ring-offset-background`** patterns from `button.tsx` and dialog close.
- Re-validate **focus rings** on light backgrounds (ring color may need theme-specific tuning).

### 13.5 Dark mode “premium” preservation

- Keep **current dark palette** as the **`.dark`** block baseline (minor tweaks only if contrast issues appear).
- Do **not** lighten dark mode to match mid-gray “enterprise default” unless intentionally decided.

---

## 14. Proposed theme toggle UX

| Item | Proposal |
|------|-----------|
| **Location** | **`AppHeader`** right cluster (near Log out) — staff-only, always available. |
| **Control type** | **Segmented three-option** (Light | Dark | System) **or** single button cycling **or** compact dropdown when Shadcn DropdownMenu is added. |
| **Labels** | Visible text: **Light**, **Dark**, **System** (accessibility-friendly); icons optional (Monitor for System). |
| **Behavior** | **Immediate** class switch; **no full page reload** required. |
| **Hydration** | Default **`dark`**; `next-themes` avoids mismatched initial client render when configured correctly; keep `suppressHydrationWarning` on `html`. |
| **Initial paint** | Accept brief flash risk; optional **`next-themes` blocking script** pattern is a **follow-up** if stakeholders require zero flash (adds complexity). |

---

## 15. UI conversion scope (MVP vs deferred)

### Must convert (MVP)

- `src/app/globals.css` — dual palettes.
- `src/app/layout.tsx` — provider wiring; remove static `dark`.
- `src/components/providers/app-providers.tsx` — include theme provider.
- `quote-work-template-ui.tsx`, `templates-library-client.tsx` — remove **`bg-zinc-*`** dialog overrides in favor of **`bg-background` / `bg-card` / `bg-muted`** as appropriate.
- `src/components/ui/dialog.tsx` — consider **tokenized overlay** (optional MVP polish).
- `src/app/(auth)/login/page.tsx` — replace **`shadow-black/40`** with theme-neutral shadow if it fails on light.
- **Status helpers:** at minimum `src/lib/schedule-readiness-ui.ts` + **`job-evidence-section.tsx`** + **quote send headline** warning colors.

### Defer (post-MVP)

- Exhaustive migration of every `amber-*` / `emerald-*` occurrence across opportunities, jobs, portal forms (track via grep during implementation).
- Company branding, admin theme overrides, portal-specific fixed theme.
- Zero-FOUC micro-scripts.

---

## 16. Test / manual QA plan

**Current test suite:** Vitest tests are **predominantly server/integration** under `src/server/**/__tests__/**`; **no** Playwright / RTL theme tests observed.

### Automated / light-touch (implementation phase)

1. **Build / lint:** `pnpm lint` / `pnpm build` (or npm equivalent) — **must pass**.
2. **Unit smoke (optional):** If a client provider test is added, keep it **minimal** (render provider + child, no snapshot churn).

### Manual QA checklist (required for Phase 16 implementation sign-off)

1. Cold load with **cleared site data** → app presents **dark** default; no hydration error overlay.
2. Toggle **Light** → shell, Work Station, Schedule, Quote workspace, Job detail remain **readable** (no white-on-white / gray-on-gray).
3. Toggle **Dark** → **visual parity** with current production intent (no accidental large hue drift).
4. Toggle **System** → matches OS appearance (verify on Windows **Settings → Personalization → Colors**).
5. **Quote** template dialogs — no stranded **zinc** “holes” in light mode.
6. **Work Station** cards — badges, primary CTA chip, blocked reasons readable in both modes.
7. **Schedule** readiness badges — especially **Ready / At risk / Blocked**.
8. **Customer portal** (token URL) — **no theme toggle**; layout sane in **light** and **dark** when global theme changes on same origin (expected shared `localStorage` behavior — document for support).
9. Regression: **logout**, **login** page, **next-auth** flows unchanged.
10. **No schema migration** when following local-only MVP.

**Existing product tests:** Should remain **unchanged** unless a test file explicitly asserts HTML class names (unlikely); verify with grep when implementing.

---

## 17. Security / product behavior notes

- Theme is **presentation-only** — **no** authz, **no** data exposure, **no** portal mutation changes.
- **Do not** store PII in theme storage keys; `next-themes` value is non-sensitive.
- **Staff vs portal:** ensure theme UI components are **not imported** into portal routes.
- **Avoid accidental workflow edits** — restrict diffs to **layout**, **providers**, **globals**, **header**, and **approved UI files**; no server action / Prisma changes for theme MVP.

---

## 18. Risks and drift prevention

| Risk | Mitigation |
|------|------------|
| Cheap light mode | Light palette **designed**, not guessed; use **muted off-whites**, tuned borders, avoid harsh pure black text on pure white without hierarchy. |
| Breaking premium dark | Move current `:root` values into **`.dark`** with minimal edits; **visual diff** dark pages before/after. |
| Hard-coded leftovers | **`rg "bg-zinc|zinc-9|zinc-95"`** in CI or PR checklist; fix high-traffic hits first. |
| Hydration mismatch | `suppressHydrationWarning` on `<html>`, correct **`attribute`**, avoid reading `localStorage` outside provider patterns. |
| Unreadable status colors | **Centralize** status colors; add light-aware tokens or `dark:` pairs for `*-100` text classes. |
| Portal leakage of staff controls | Toggle only in **authenticated chrome**; code review gate on `portal/*` imports. |
| Schema creep | **Explicitly exclude** DB prefs in MVP charter. |
| Token inconsistency | Document **allowed** prefixes in PR template; prefer **`bg-card`** over raw zinc for surfaces. |
| Workflow regressions | **No** changes to server phases, DTOs, or actions under `/server/phase*` for theme MVP. |

---

## 19. Explicit non-goals (Phase 16)

- DB-backed appearance, org-level branding, portal customer theme picker.
- Full-app `dark:` rewrite without strategy.
- Invert / CSS `filter` hacks.
- Changing **status enums**, lifecycle rules, or **schedule readiness semantics**.
- Adding heavy visual E2E framework **solely** for theme (optional later).

---

## 20. Implementation prompt readiness checklist

Before prompting implementation in a future phase:

- [ ] Stakeholders confirm **dark remains default** and **light** is “professional contractor SaaS” not marketing blog white.
- [ ] Agree **status strategy** (new CSS vars vs `dark:` pairing) — pick one to reduce drift.
- [ ] Agree **toggle placement** (`AppHeader` vs alternatives).
- [ ] Confirm **portal inherits tokens** with **no staff UI** on `/portal/*`.
- [ ] Reserve **small QA budget** (manual checklist above).
- [ ] After implementation: **`rg`** audits for `zinc-9`, `shadow-black`, `className="dark"` on `html`.

---

## Appendix — quick code citations (recon evidence)

**Tailwind class dark mode:**

```4:6:c:\Users\Cody\Projects\Struxient_v4\tailwind.config.ts
const config: Config = {
  darkMode: ["class"],
  content: [
```

**globals: single dark-flavored `:root` (no `.dark` block):**

```5:27:c:\Users\Cody\Projects\Struxient_v4\src\app\globals.css
@layer base {
  :root {
    --background: 240 6% 4%;
    --foreground: 210 20% 98%;
    --card: 240 5% 6%;
    --card-foreground: 210 20% 98%;
    --popover: 240 5% 8%;
    --popover-foreground: 210 20% 98%;
    --primary: 217 91% 55%;
    --primary-foreground: 222 47% 11%;
    --secondary: 240 4% 12%;
    --secondary-foreground: 210 20% 98%;
    --muted: 240 4% 16%;
    --muted-foreground: 215 14% 62%;
    --accent: 217 91% 55%;
    --accent-foreground: 222 47% 11%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 210 20% 98%;
    --border: 240 4% 16%;
    --input: 240 4% 16%;
    --ring: 217 91% 55%;
    --radius: 0.25rem;
  }
```

**Root layout forces `dark` on `html`:**

```26:31:c:\Users\Cody\Projects\Struxient_v4\src\app\layout.tsx
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
```

**Providers today (session only):**

```1:8:c:\Users\Cody\Projects\Struxient_v4\src\components\providers\app-providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**Schedule readiness badge classes (hard-coded hues):**

```24:42:c:\Users\Cody\Projects\Struxient_v4\src\lib\schedule-readiness-ui.ts
export function readinessBadgeClassName(label: ScheduleReadinessLabel): string {
  switch (label) {
    case "SCHEDULED_READY":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
    case "SCHEDULED_AT_RISK":
      return "border-amber-500/40 bg-amber-500/10 text-amber-100";
    case "SCHEDULED_BLOCKED":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "READY_TO_SCHEDULE":
      return "border-primary/40 bg-primary/10 text-primary";
    case "NOT_SCHEDULABLE":
      return "border-border bg-muted/30 text-muted-foreground";
    case "COMPLETED":
      return "border-border bg-muted/20 text-muted-foreground";
    case "CANCELED":
      return "border-border bg-muted/20 text-muted-foreground";
    default:
      return "border-border bg-muted/30 text-muted-foreground";
  }
}
```

**Portal uses semantic page chrome (inherits future light palette):**

```17:19:c:\Users\Cody\Projects\Struxient_v4\src\app\portal\[token]\portal-customer-view.tsx
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/30">
```

---

**End of Phase 16 planning / recon document.**
