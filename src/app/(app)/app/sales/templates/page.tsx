import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { canManageQuoteWorkTemplates } from "@/lib/phase3-permissions";
import { AccessDeniedPanel } from "@/components/phase1/access-denied-panel";
import { requireOrgSession } from "@/server/phase1/org-session";
import {
  listQuoteWorkTemplatesForLibrary,
  resolveQuoteWorkTemplateLibraryDetail,
} from "@/server/phase3/template-queries";
import { templateLibrarySearchSchema } from "@/server/phase3/validation";
import { TemplatesLibraryClient, type TemplatesLibrarySerializedProps } from "./templates-library-client";

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function WorkTemplatesLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrgSession();
  if (!canAuthorQuotes(ctx.role)) {
    return (
      <AccessDeniedPanel
        title="Work templates"
        description="The template library is available to sales and office roles that can author quotes. If you need access, ask an administrator to update your membership role."
      />
    );
  }

  const raw = await searchParams;
  const parsed = templateLibrarySearchSchema.safeParse({
    kind: firstParam(raw.kind),
    q: firstParam(raw.q),
    status: firstParam(raw.status),
    selected: firstParam(raw.selected),
  });

  const filters = parsed.success
    ? parsed.data
    : { status: "active" as const, kind: undefined, q: undefined, selected: undefined };

  const rows = await listQuoteWorkTemplatesForLibrary(ctx.organizationId, {
    kind: filters.kind,
    search: filters.q,
    status: filters.status,
  });

  const detailResult = filters.selected
    ? await resolveQuoteWorkTemplateLibraryDetail(ctx.organizationId, filters.selected)
    : null;

  const serialized: TemplatesLibrarySerializedProps = {
    rows: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      description: r.description,
      tags: r.tags,
      contentVersion: r.contentVersion,
      updatedAt: r.updatedAt.toISOString(),
      archivedAt: r.archivedAt?.toISOString() ?? null,
    })),
    filters: {
      kind: filters.kind,
      q: filters.q,
      status: filters.status,
      selected: filters.selected,
    },
    detail:
      detailResult?.ok === true
        ? {
            id: detailResult.detail.id,
            kind: detailResult.detail.kind,
            name: detailResult.detail.name,
            description: detailResult.detail.description,
            tags: detailResult.detail.tags,
            contentVersion: detailResult.detail.contentVersion,
            updatedAt: detailResult.detail.updatedAt.toISOString(),
            archivedAt: detailResult.detail.archivedAt?.toISOString() ?? null,
            preview: detailResult.detail.preview,
          }
        : detailResult?.ok === false
          ? { reason: detailResult.reason }
          : null,
    canManage: canManageQuoteWorkTemplates(ctx.role),
  };

  return <TemplatesLibraryClient {...serialized} />;
}
