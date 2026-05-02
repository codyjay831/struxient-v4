# Prisma `generate` on Windows (EPERM / file lock)

## Symptom

`npx prisma generate` fails with:

`EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp...' -> '...query_engine-windows.dll.node'`

This is a **filesystem lock** on the Prisma engine binary under `node_modules/.prisma/client/`, not a schema defect.

## Safe local fix (no code workarounds)

1. **Stop processes** that may hold the DLL open: dev servers (`next dev`), test runners, other terminals running Node against this repo, Prisma Studio, and IDE extensions that run Prisma on save.
2. **Retry** `npx prisma generate` from a **fresh** shell in the project root.
3. If it still fails, **delete the generated client folder** and regenerate:
   - Remove `node_modules/.prisma` (or the whole `node_modules` if you prefer a clean install).
   - Run `npm install` (restores dependencies; `postinstall` runs `prisma generate` if configured).
   - Or run `npx prisma generate` explicitly after removal.
4. **Antivirus / Controlled folder access**: temporarily allow the repo path or exclude `node_modules/.prisma` from real-time scanning if your environment blocks in-place binary renames.
5. **OneDrive / synced Desktop**: avoid keeping the repo under a synced folder that locks files during rename.

## What not to do

- Do not commit generated Prisma client output to work around local locks.
- Do not change `schema.prisma` solely to make `generate` pass when the error is clearly EPERM on rename.

## Verification

After cleanup: `npx prisma generate` exits **0**, then `npm run build` should still succeed.
