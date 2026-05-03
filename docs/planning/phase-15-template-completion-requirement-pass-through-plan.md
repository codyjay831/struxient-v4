# Phase 15 — Planning / Recon: Template/Library `completionRequirementsJson` Pass-through MVP

**Mode:** Planning / recon only (no implementation in this document’s authoring pass).  
**Goal:** Smallest safe MVP so `QuoteLineExecutionTask.completionRequirementsJson` round-trips through org-scoped modular quote work templates (`QuoteWorkTemplate`), aligned with Phase 13/14 sealed behavior.

---

## 1. Verdict / recommended MVP

**Recommend Option A — payload-only optional pass-through** (strict v1 shape, no Prisma schema change, no `sentSnapshotJson` version bump).

- Extend **`templateExecutionTaskPayloadSchema`** (and thus nested line/stage/task template payloads) with an **optional** `completionRequirementsJson` that, when present, must satisfy the **same strict v1 evidence requirement model** as job/quote rows (`completionRequirementsV1Schema` / `parseJobTaskCompletionRequirements`).
- **`taskToPayload`** in `template-payloads.serialize.ts` should **copy canonical requirements** from `QuoteLineExecutionTask.completionRequirementsJson` when the parsed result is `kind: "valid"`; otherwise **omit** the field (equivalent to no gate).
- **`materializeLineItemWithPlan`**, **`materializeStageWithTasks`**, and **`materializeTask`** should set `QuoteLineExecutionTask.completionRequirementsJson` on `create` using **revalidated canonical v1** or `Prisma.JsonNull`.
- **Save path:** validate + canonicalize before persisting `payloadJson` (fail closed if any task carries invalid requirement JSON).
- **Apply path:** revalidate when parsing template payload (already strict Zod); add explicit requirement validation pass before `create` so invalid stored payloads **fail the mutation with a clear error** and **never** write partially materialized corrupt tasks (transaction already wraps inserts).
- Keep **`TEMPLATE_PAYLOAD_VERSION = 1`** and **`QuoteWorkTemplate.payloadVersion`** at **1** if the new field is optional and older rows parse without it (Zod default: missing optional → undefined → stripped by `JSON.stringify` in normalization).
- **No** change to activation’s snapshot-only read model or to customer preview/portal DTO surfaces beyond regression tests.

**Implementation safe to prompt next:** **Yes**, with bounded scope in the files listed in §12–13. **Blockers:** none found in recon. **Unknowns / decisions:** (1) Whether template library staff preview should show a **non-JSON** “completion gate” badge only (UX §11); (2) Whether corrupted historical `payloadJson` should be treated as **insert-blocked** until metadata repair vs. admin tooling (recommend: **block apply**, same as today’s invalid payload handling).

---

## 2. Files inspected

| Area | Path |
|------|------|
| Prisma schema | `prisma/schema.prisma` |
| Phase 14 migration | `prisma/migrations/20260506000000_phase14_quote_line_execution_completion_requirements/migration.sql` |
| Template payload schema / parsers | `src/server/phase3/template-payloads.ts` |
| Quote → template payload serialization | `src/server/phase3/template-payloads.serialize.ts` |
| Template → quote materialization | `src/server/phase3/template-materialize.ts` |
| Save / apply / archive / metadata | `src/server/phase3/template-mutations.ts` |
| Template input validation (FormData) | `src/server/phase3/validation.ts` |
| Library list/detail | `src/server/phase3/template-queries.ts` |
| Quote workspace include | `src/server/phase2/quote-queries.ts` |
| Mark sent + snapshot | `src/server/phase2/quote-mutations.ts` |
| Snapshot v2 + internal plan builder | `src/server/phase2/customer-preview.ts` |
| Send-time requirement validation | `src/server/phase14/quote-completion-requirements.ts` |
| Strict v1 parser + DTO helpers | `src/server/phase13/completion-requirements.ts` |
| Activation from snapshot | `src/server/phase4/job-activation.ts` |
| Phase 3 permissions | `src/lib/phase3-permissions.ts` |
| Portal DTOs | `src/server/phase8/portal-dtos.ts` |
| Portal leakage tests | `src/server/phase8/__tests__/portal-dtos-leakage.test.ts` |
| Template library UI | `src/app/(app)/app/sales/templates/templates-library-client.tsx` |
| Quote page props (staff completion DTO) | `src/app/(app)/app/sales/quotes/[quoteId]/page.tsx` |
| Template payload unit tests | `src/server/phase3/__tests__/template-payloads.test.ts` |
| Phase 14 integration | `src/server/phase14/__tests__/phase14-quote-planned-completion-requirements.integration.test.ts` |
| Customer preview tests | `src/server/phase2/__tests__/customer-preview.test.ts` |

---

## 3. Current implementation findings

### 3.1 Prisma models (relevant fields)

- **`QuoteLineExecutionTask`** — includes `completionRequirementsJson Json?` (Phase 14). Comment in schema: planned runtime completion gate; frozen at send; not customer-facing.

```834:851:c:\Users\Cody\Projects\Struxient_v4\prisma\schema.prisma
model QuoteLineExecutionTask {
  id                       String          @id @default(cuid())
  organizationId         String
  stageId                String
  title                  String
  // ...
  /// Planned runtime completion gate (strict v1 JSON). Frozen into sent snapshot; not customer-facing.
  completionRequirementsJson Json?
  // ...
}
```

- **`QuoteLineExecutionStage`** — no requirement field (correct); tasks carry requirements.

- **`JobTask`** — `completionRequirementsJson Json?` (Phase 13). Activation copies from snapshot tasks.

```550:573:c:\Users\Cody\Projects\Struxient_v4\prisma\schema.prisma
model JobTask {
  // ...
  completionRequirementsJson Json?
  // ...
}
```

- **`QuoteWorkTemplate`** — org-scoped reusable blueprint: `payloadJson Json`, `payloadVersion Int @default(1)`, `contentVersion Int @default(1)`, `kind` enum `LINE_ITEM_WITH_PLAN | STAGE_WITH_TASKS | TASK`. **No** per-task normalized table; execution task shape is **entirely inside `payloadJson`**.

```791:812:c:\Users\Cody\Projects\Struxient_v4\prisma\schema.prisma
model QuoteWorkTemplate {
  id               String                @id @default(cuid())
  organizationId String
  kind             QuoteWorkTemplateKind
  name             String
  // ...
  payloadVersion   Int                   @default(1)
  contentVersion   Int                   @default(1)
  payloadJson      Json
  // ...
}
```

- **`QuoteLineItem`** — `sourceTemplateId`, `sourceTemplateKind`, `sourceTemplateVersion`, `sourceTemplateName` document **copy provenance** only (informational; no live FK to template execution).

### 3.2 Phase 13/14 parsing, validation, canonicalization

- **Single strict v1 schema and parser:** `src/server/phase13/completion-requirements.ts` defines `completionRequirementsV1Schema`, `parseJobTaskCompletionRequirements` (null/undefined → `none`; invalid shape/version → `invalid`; `evidence.required === false` → `none`), and `serializeEvidenceRequirementInput` for staff form → canonical object.

- **Quote send gate:** `src/server/phase14/quote-completion-requirements.ts` — `validateQuoteLineTasksCompletionRequirementsForSend` walks all line execution tasks and rejects send if any `parseJobTaskCompletionRequirements` is `invalid`.

- **Frozen snapshot embedding:** `buildInternalExecutionPlanFromLineItems` in `src/server/phase2/customer-preview.ts` embeds **`completionRequirementsJson: req.v1`** only when parse is `valid`; otherwise omits the property from the snapshot task object (backward compatible for legacy snapshots).

- **Activation:** `activateAcceptedQuoteAsJobInTransaction` in `src/server/phase4/job-activation.ts` reads **`quote.sentSnapshotJson` only**, parses with `sentQuoteSnapshotV2Schema`, iterates `plan.lines[].stages[].tasks[]`, re-parses each task’s optional `completionRequirementsJson`, fails closed on `invalid`, persists canonical `pr.v1` on `JobTask`.

**Reuse for Phase 15:** `parseJobTaskCompletionRequirements` + canonical `v1` object for storage; do **not** duplicate Zod shapes in Phase 3.

### 3.3 Template save flow (quote → `QuoteWorkTemplate`)

- **RBAC:** `quoteMutationSaveLineItemAsTemplate`, `quoteMutationSaveStageAsTemplate`, `quoteMutationSaveExecutionTaskAsTemplate` in `src/server/phase3/template-mutations.ts` require **`canAuthorQuotes`** (not `canManageQuoteWorkTemplates`). Archive/restore/metadata use **`canManageQuoteWorkTemplates`**.

- **Structural lock:** Each save path rejects when `isQuoteStructurallyLocked(quote.status)` — same as “sent quotes cannot be edited into templates” pattern.

- **Payload build:** Uses `buildLineItemWithPlanPayloadFromLine`, `buildStageWithTasksPayloadFromStage`, `buildTaskPayloadFromTask` from `template-payloads.serialize.ts`, then `payloadToJsonValue` → `prisma.quoteWorkTemplate.create`.

- **Omission today:** `taskToPayload` **does not** read `completionRequirementsJson`, so requirements are **dropped** on save.

```32:44:c:\Users\Cody\Projects\Struxient_v4\src\server\phase3\template-payloads.serialize.ts
function taskToPayload(t: ExecTask) {
  return {
    title: t.title.trim(),
    description: t.description?.trim() ? t.description.trim() : null,
    isRequired: t.isRequired,
    sortOrder: t.sortOrder,
    assignedRole: t.assignedRole?.trim() ? t.assignedRole.trim() : null,
    estimatedDurationMinutes: t.estimatedDurationMinutes,
    customerVisible: t.customerVisible,
    customerLabel: t.customerLabel?.trim() ? t.customerLabel.trim() : null,
    internalNotes: t.internalNotes?.trim() ? t.internalNotes.trim() : null,
  };
}
```

- **Zod envelope:** `templateExecutionTaskPayloadSchema` in `template-payloads.ts` lists only the fields above — **no** `completionRequirementsJson`.

```37:52:c:\Users\Cody\Projects\Struxient_v4\src\server\phase3\template-payloads.ts
export const templateExecutionTaskPayloadSchema = z.object({
  title: nonEmptyTrimmed.max(500),
  description: optionalText,
  isRequired: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional(),
  assignedRole: z
    .string()
    .max(120)
    .optional()
    .nullable()
    .transform((s) => (s?.trim() ? s.trim() : null)),
  estimatedDurationMinutes: z.coerce.number().int().positive().optional().nullable(),
  customerVisible: z.boolean().optional().default(false),
  customerLabel: optionalShortText,
  internalNotes: optionalText,
});
```

- **Audit:** `recordQuoteActivity` with `QUOTE_WORK_TEMPLATE_*_SAVED` and payload containing `templateId` (+ line/stage/task ids).

### 3.4 Template apply flow (`QuoteWorkTemplate` → quote rows)

- **RBAC:** Insert mutations use **`canAuthorQuotes`**.

- **Structural lock:** `isQuoteStructurallyLocked(quote.status)` → **“Sent quotes cannot receive template inserts.”**

- **Parse:** `parseLineItemWithPlanPayload` / `parseStageWithTasksPayload` / `parseTaskOnlyPayload` on `tmpl.payloadJson`.

- **Materialize:** `materializeLineItemWithPlan`, `materializeStageWithTasks`, `materializeTask` in `template-materialize.ts` create `QuoteLineExecutionTask` rows **without** `completionRequirementsJson` in `data` — DB default null.

```87:101:c:\Users\Cody\Projects\Struxient_v4\src\server\phase3\template-materialize.ts
      await tx.quoteLineExecutionTask.create({
        data: {
          organizationId,
          stageId: stage.id,
          title: tp.title,
          description: tp.description,
          status: QuoteTaskStatus.NOT_READY,
          isRequired: Boolean(tp.isRequired),
          sortOrder: taskSort,
          assignedRole: tp.assignedRole,
          estimatedDurationMinutes: tp.estimatedDurationMinutes ?? null,
          customerVisible: Boolean(tp.customerVisible),
          customerLabel: tp.customerLabel,
          internalNotes: tp.internalNotes,
        },
      });
```

- **Copy semantics:** New line items get `sourceTemplate*` metadata on line insert only; stage/task inserts do not attach template ids to individual tasks (still **quote-owned rows**; no live link).

### 3.5 Send / freeze / activation relationship

- **Send:** `quoteMutationMarkSent` loads **`getQuoteWorkspace`** (includes all scalar task fields, so **`completionRequirementsJson`** is present on tasks), runs **`validateQuoteLineTasksCompletionRequirementsForSend`**, builds **`buildInternalExecutionPlanFromLineItems(full.lineItems)`**, assembles **v2 snapshot** `{ version: 2, preview, internalExecutionPlan, ... }`, validates via **`parseValidatedSentQuoteSnapshot`**, persists to **`quote.sentSnapshotJson`**.

```1312:1336:c:\Users\Cody\Projects\Struxient_v4\src\server\phase2\quote-mutations.ts
  const completionSend = validateQuoteLineTasksCompletionRequirementsForSend(full.lineItems);
  if (!completionSend.ok) {
    return { ok: false, error: completionSend.error };
  }
  // ...
  const internalExecutionPlan = buildInternalExecutionPlanFromLineItems(full.lineItems);
  const snapshot = {
    version: 2 as const,
    sentAt: sentAt.toISOString(),
    quoteId: full.id,
    displayNumber: full.displayNumber,
    preview,
    internalExecutionPlan,
  };
```

- **Conclusion for Phase 15:** Once apply materializes **`QuoteLineExecutionTask.completionRequirementsJson`** on quote rows, **no template-specific send change** is required: existing send path already freezes requirements from **live quote rows** at send time (subject to send validation). Activation already consumes **snapshot only**.

### 3.6 Customer preview / portal leakage check

- **Customer preview DTO** is built by **`buildQuoteCustomerPreviewDTO`** (`customer-preview.ts`). Line execution input type **`QuotePreviewLineWithExecution`** only picks **`customerVisible` / `customerLabel`** from tasks — **not** `completionRequirementsJson`. Highlights are labels only.

- **Portal quote DTO:** `portalQuoteDTOSchema` in `portal-dtos.ts` **equals** `quoteCustomerPreviewDTOSchema` — same customer-safe surface.

- **Regression guard:** `portal-dtos-leakage.test.ts` asserts serialized portal view does not contain substring **`completionRequirementsJson`** (among other forbidden internals).

- **Staff quote workspace** (`page.tsx`) intentionally maps **`completionRequirement: toCompletionRequirementDto(parseJobTaskCompletionRequirements(...))`** for planned execution tasks — **staff-only** route; not used for portal.

**Phase 15 must not** add requirements to preview/portal schemas or milestone cards.

---

## 4. Current template payload shape (code)

Defined in **`src/server/phase3/template-payloads.ts`** (`TEMPLATE_PAYLOAD_VERSION === 1`):

- **`LINE_ITEM_WITH_PLAN`:** `{ line: lineItemPlanLinePayloadSchema, stages: lineItemPlanStagePayloadSchema[] }` where each stage has `{ title, internalNotes, sortOrder?, tasks: templateExecutionTaskPayloadSchema[] }`.

- **`STAGE_WITH_TASKS`:** `{ stage: { title, internalNotes }, tasks: templateExecutionTaskPayloadSchema[] }`.

- **`TASK`:** `{ task: templateExecutionTaskPayloadSchema }`.

**Execution task object (today):** `title`, `description`, `isRequired`, `sortOrder`, `assignedRole`, `estimatedDurationMinutes`, `customerVisible`, `customerLabel`, `internalNotes` — **no** `completionRequirementsJson`.

---

## 5. Current save flow (summary)

1. User submits save-from-quote FormData → `template-mutations.ts` mutation.  
2. **`canAuthorQuotes`** + not structurally locked + workspace loaded via **`getQuoteWorkspace`**.  
3. **`build*PayloadFrom*`** → **`normalizePayloadJson`** (Zod round-trip).  
4. **`quoteWorkTemplate.create`** with `payloadVersion: TEMPLATE_PAYLOAD_VERSION` (1).  
5. **`recordQuoteActivity`**.

**Drop behavior:** `completionRequirementsJson` never enters payload.

---

## 6. Current apply flow (summary)

1. **`canAuthorQuotes`** + quote not structurally locked.  
2. Load template via **`getQuoteWorkTemplateForOrg`**.  
3. **`parse*Payload`**.  
4. Transaction → **`materialize*`** creates stages/tasks.  
5. **`recordQuoteActivity`**.

**Drop behavior:** `completionRequirementsJson` not written on created tasks.

---

## 7. Send / freeze / activation (relationship recap)

| Step | Source of requirements |
|------|-------------------------|
| Live quote edit | `QuoteLineExecutionTask.completionRequirementsJson` (validated on add/update in `quote-mutations.ts` via `quoteLineExecutionCompletionJsonFromForm`) |
| Send | Validates all tasks; **`buildInternalExecutionPlanFromLineItems`** copies canonical v1 into **snapshot** |
| Activation | **`sentSnapshotJson`** → `JobTask.completionRequirementsJson` |

Templates are **not** in this chain unless they first **materialize onto quote rows**.

---

## 8. Customer preview / portal leakage check (explicit)

| Surface | Exposes `completionRequirementsJson`? |
|---------|--------------------------------------|
| `buildQuoteCustomerPreviewDTO` | **No** |
| `sentQuoteSnapshotV2Schema.preview` | **No** |
| `portalQuoteDTOSchema` / `portalViewDTOSchema` | **No** |
| `portal-dtos-leakage.test.ts` | Guards against substring in serialized portal view |

**Staff** template library detail renders parsed payload to authenticated sales UI — acceptable **internal** surface; Phase 15 optional badge should use **DTO or boolean**, not raw JSON, if added.

---

## 9. Options comparison

| Criterion | **A — Optional payload field (v1)** | **B — New `payloadVersion` / bump** | **C — New DB column / normalized model** | **D — Defer** |
|-----------|-------------------------------------|--------------------------------------|---------------------------------------------|---------------|
| **Safety** | High: same parser as Phase 13/14; fail closed on invalid | High, similar | High but heavy | N/A (risk of drift remains) |
| **Backward compatibility** | Old templates without field parse unchanged | Requires branching on version | Migration + dual read paths | Preserves known gap |
| **Schema / migration** | **None** | **None** (version int only if bumping `payloadVersion` convention) | **Prisma migration** + write paths | None |
| **Truth confusion** | Low if copy-only semantics preserved | Low | Medium (second source of truth) | Users confuse template vs quote |
| **Testability** | Excellent: unit + integration | Good: + version matrix | Higher cost | None |
| **UX impact** | Minimal; optional library badge | Minimal | Often drives UI | None |
| **Canon fit** | Strong: templates as blueprints, copy-only, validated JSON | Strong | Weaker: over-normalized for MVP | Conflicts with “quote = blueprint” completeness |

**Recommendation:** **A** — recommended MVP. **B** optional only if product wants hard telemetry split (usually unnecessary if Zod optional field is sufficient). **C** — **reject** for MVP (schema churn, no current normalized task table). **D** — **reject** as Phase 15 outcome (explicit Phase 14 deferral to close).

---

## 10. Recommended data / payload plan (no implementation)

- **Add** to `templateExecutionTaskPayloadSchema`:  
  `completionRequirementsJson: completionRequirementsV1Schema.optional()`  
  — OR accept `unknown` and pipe through **`parseJobTaskCompletionRequirements`** in a **superRefine** / preprocess (prefer **reuse parser** for one codepath).

- **Canonical shape:** Identical to **`CompletionRequirementsV1Parsed`** — `version: 1` literal + `.strict()` evidence block (same as Phase 13).

- **Null / undefined:**  
  - **Omit** field in normalized JSON when `none` / absent (matches snapshot builder style).  
  - DB `QuoteLineExecutionTask.completionRequirementsJson` → **`Prisma.JsonNull`** when no gate.

- **Canonicalization on save:** After parsing, if `valid`, persist **`pr.v1`** (not raw DB copy) inside template payload so templates do not accumulate drift or invalid-but-unreferenced blobs.

- **Invalid payload behavior:**  
  - **Save:** reject with error if any sourced task has `invalid` requirements (should be rare post–Phase 14 quote mutations).  
  - **Apply:** reject insert if template payload contains invalid requirement (post-Zod, parser `invalid`); **no** partial line/stage/task corruption.

- **Old templates:** Missing field → **no gate** on materialized tasks.

- **Manual DB tampering:** Invalid JSON in template → **apply fails** (library already surfaces `invalid_payload` for parse errors; extend messaging for requirement-specific failure).

---

## 11. Recommended save / apply plan

### Template save (quote → template)

1. **Source of truth:** `QuoteLineExecutionTask.completionRequirementsJson` from **`getQuoteWorkspace`**-loaded task rows.  
2. **Transform:** Extend **`taskToPayload`** to attach canonical requirements when `parseJobTaskCompletionRequirements` → `valid`.  
3. **Validate:** **`normalizePayloadJson`** already re-parses entire payload; add **per-task requirement check** either in Zod (preferred: single schema) or assert pass after `normalizePayloadJson` in save mutations.  
4. **Persist:** unchanged `QuoteWorkTemplate.payloadJson` storage.  
5. **RBAC / tenant:** unchanged (`organizationId` from session; `getQuoteWorkspace` scoped).  
6. **Audit:** unchanged event types; optionally extend payload with `hasCompletionGates: boolean` (optional, not required for MVP).

### Template apply (template → quote)

1. After Zod `parse*Payload`, **iterate all embedded tasks** and run **`parseJobTaskCompletionRequirements`** on optional field.  
2. On `invalid` → return **`{ ok: false, error: "…" }`** before transaction (or throw inside transaction and map to user-safe message).  
3. **`materialize*`** passes **`completionRequirementsJson`** into `create` data: canonical v1 JSON or null.  
4. **SENT+ lock:** already enforced in insert mutations — **no change**.  
5. **Copy-only:** unchanged; editing quote after apply does not touch `QuoteWorkTemplate` until explicit save-template action.

---

## 12. UI impact plan

- **Quote workspace:** Phase 14 controls already bind to **`QuoteLineExecutionTask.completionRequirementsJson`**. After apply pass-through, requirements **appear** when present — **no overhaul** required.

- **Template library (`templates-library-client.tsx`):** Today renders task title, required flag, customer visibility, internal notes. **Optional MVP:** a single line like **“Completion gate: on”** derived from **`toCompletionRequirementDto`** / parse state **active**, **without** dumping JSON. **Not** required for correctness.

- **Customer / portal:** **No** UI or DTO changes.

---

## 13. Test plan (categories and likely files)

| # | Requirement | Likely location |
|---|-------------|-----------------|
| 1 | Old template without `completionRequirementsJson` parses/applies | `src/server/phase3/__tests__/template-payloads.test.ts`, `src/server/phase3/__tests__/quote-work-templates.integration.test.ts` |
| 2 | Save preserves canonical v1 | New cases in **`quote-work-templates.integration.test.ts`** or dedicated **`phase15-template-completion-requirements.integration.test.ts`** |
| 3 | Apply writes `QuoteLineExecutionTask.completionRequirementsJson` | Same integration suite |
| 4 | Invalid requirement in template fails apply safely | Integration + unit on parser edge |
| 5 | Send after apply embeds requirements in `internalExecutionPlan` | Extend Phase 14-style test or Phase 3 integration (mark sent helper) |
| 6 | Activation copies to `JobTask` from snapshot | Reuse patterns from **`phase14-quote-planned-completion-requirements.integration.test.ts`** |
| 7 | Editing quote task after apply does not mutate `QuoteWorkTemplate.payloadJson` | Integration: fetch template row before/after quote update |
| 8 | Preview/portal DTOs still clean | Run / extend **`portal-dtos-leakage.test.ts`**, **`customer-preview.test.ts`** if any shared serializer changes |
| 9 | Tenant/RBAC | Existing `canAuthorQuotes` / org scoping assertions in integration tests |
| 10 | SENT+ structural lock on insert | Existing assertions; keep coverage |
| 11 | No schema drift if no migration | Schema unchanged under Option A — CI **`prisma validate`** / generate as usual |
| 12 | If schema ever added (not recommended MVP) | Migration + full seal commands per project convention |

---

## 14. Security / tenant / RBAC notes

- **Tenant isolation:** All template and quote operations already scoped by **`ctx.organizationId`** and `getQuoteWorkTemplateForOrg` / `getQuoteWorkspace`.

- **RBAC:** Save/insert templates: **`canAuthorQuotes`**; library archive/restore/metadata: **`canManageQuoteWorkTemplates`** (`phase3-permissions.ts`).

- **Server-side validation:** Requirements must never be trusted from client JSON alone; template payload is stored server-side but **originated from staff actions** — still validate on **save and apply** with **`parseJobTaskCompletionRequirements`**.

- **Canonical storage:** Prevents “junk JSON” in `payloadJson` and aligns with Phase 14 send rules.

- **No client-only gates:** Keep mutations server-only (existing pattern).

---

## 15. Risks and drift-prevention notes

| Risk | Mitigation |
|------|------------|
| Template vs live execution truth | Keep **copy-only**; document that templates are seeds; activation still **snapshot-only**. |
| Customer leakage | Do not add fields to **`quoteCustomerPreviewDTOSchema`** / **`portalQuoteDTOSchema`**; staff library uses compact DTO only. |
| Arbitrary JSON in templates | Zod + **`parseJobTaskCompletionRequirements`**; fail save/apply. |
| Old templates | Optional field; missing → null task column. |
| Activation reading mutable quote | Already avoided; Phase 15 does not change activation. |
| Overbuilding template UX | Default **no** library UI change; optional badge only. |
| Schema/client drift | TypeScript types from Zod `infer`; run tests + lint. |
| Windows Prisma `EPERM` | Environment/file-lock issue per **`docs/planning/prisma-generate-windows-reliability.md`** — not a product blocker for design approval. |

---

## 16. Explicit non-goals (Phase 15)

- No portal/customer visibility for completion requirements.  
- No auto-complete from evidence.  
- No change to task completion semantics (Phase 13).  
- No `sentSnapshotJson` version bump unless recon in implementation discovers a hard incompatibility (**recon found none**).  
- No activation source change.  
- No live-linked templates.  
- No silent template mutation from quote/job edits.  
- No new packet/versioning architecture.  
- No template builder UX overhaul.  
- No AI/OCR.  
- No weakening validation or tests.

---

## 17. Implementation prompt readiness checklist

- [ ] Extend **`templateExecutionTaskPayloadSchema`** (+ exports) for optional v1 requirements.  
- [ ] Extend **`taskToPayload`** / builders to emit canonical v1 when present.  
- [ ] Extend **`materialize*`** to persist `completionRequirementsJson`.  
- [ ] Add save-time + apply-time validation pass (clear errors).  
- [ ] Unit tests: **`template-payloads.test.ts`**.  
- [ ] Integration tests: save/apply/send/activation chain + RBAC + SENT lock regressions.  
- [ ] Confirm **`portal-dtos-leakage`** and **`buildQuoteCustomerPreviewDTO`** unchanged behavior.  
- [ ] Run **`npm run test -- --run`**, **`npm run lint`**, **`npm run build`** (and Prisma generate/migrate per repo seal).  
- [ ] Optional: library preview badge using **DTO**, not raw JSON.

---

## Report meta

- **Path:** `docs/planning/phase-15-template-completion-requirement-pass-through-plan.md`  
- **Recommended MVP summary:** **Option A** — optional `completionRequirementsJson` on template execution task payloads, **reuse Phase 13 parser**, **canonicalize on save**, **revalidate on apply**, **materialize to quote tasks**, **no Prisma migration**, **no snapshot version bump**.  
- **Safe to prompt implementation next:** **Yes.**  
- **Blockers / unknowns:** **None** for technical design; **UX optional** for library badge; **policy** on repairing manually corrupted template JSON = **fail apply** (recommended).
