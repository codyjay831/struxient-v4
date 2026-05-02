# Archived opportunity status (Phase 1)

## Decision

**Option A — defer archive UI in Phase 1.**

`OpportunityStatus.ARCHIVED` exists in the Prisma enum for forward compatibility and filtering (e.g. list views), but there is **no** “Archive opportunity” action in Phase 1.

## Rationale

- Avoid scope creep and restore/unarchive design questions while intake, lost, and no-quote paths are still maturing.
- Users are not stuck: **Lost** and **No quote** are the supported terminal outcomes with required reasons. **Archived** is optional metadata for later housekeeping UIs.
- Pipeline status edits on open opportunities remain within non-terminal states via the intake form; `ARCHIVED` is excluded from that control by design.

## Later

When product needs housekeeping, add an explicit archive action with permission checks, org scoping, activity events, and a documented policy on whether restore is allowed.
