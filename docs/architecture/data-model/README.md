# Data Model — Planning Canon

## Why this folder exists

Documents under `docs/architecture/data-model/` describe **conceptual entities and relationships** for Struxient v4 planning. They are **not** approved migrations or final Prisma schema.

## Main document

| File | Purpose |
|------|---------|
| [struxient-v4-entity-map.md](./struxient-v4-entity-map.md) | Conceptual entity map: Customer → Opportunity → Quote → Job → tasks/events, plus catalog, gates, portal, communication |

## Relationship to other canon

- **Execution workflow:** [execution-workflow](../execution-workflow/README.md) — lifecycle, quote bridge, engine, tasks, outcomes.  
- **App shell:** [app-shell](../app-shell/README.md) — where users touch Customers, Jobs, Sales, Work Station.

**Note:** Until the [canon-to-code audit](../../audit/struxient-v4-canon-to-current-code-mapping.md) is populated with real paths, treat entity names as **planning vocabulary**, not guaranteed table names in the Struxient v4 codebase.
