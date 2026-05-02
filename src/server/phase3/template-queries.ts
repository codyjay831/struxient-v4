import { QuoteWorkTemplateKind } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseLineItemWithPlanPayload,
  parseStageWithTasksPayload,
  parseTaskOnlyPayload,
  type LineItemWithPlanPayload,
  type StageWithTasksPayload,
  type TaskOnlyPayload,
} from "@/server/phase3/template-payloads";

export type QuoteWorkTemplateListItem = {
  id: string;
  kind: QuoteWorkTemplateKind;
  name: string;
  description: string | null;
  tags: string[];
  contentVersion: number;
  updatedAt: Date;
};

function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean);
}

export async function listActiveQuoteWorkTemplates(
  organizationId: string,
  kind?: QuoteWorkTemplateKind,
): Promise<QuoteWorkTemplateListItem[]> {
  const rows = await prisma.quoteWorkTemplate.findMany({
    where: {
      organizationId,
      archivedAt: null,
      ...(kind ? { kind } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      kind: true,
      name: true,
      description: true,
      tagsJson: true,
      contentVersion: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    description: r.description,
    tags: parseTags(r.tagsJson),
    contentVersion: r.contentVersion,
    updatedAt: r.updatedAt,
  }));
}

export async function getQuoteWorkTemplateForOrg(organizationId: string, templateId: string) {
  return prisma.quoteWorkTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
}

export async function listActiveQuoteWorkTemplatesGrouped(organizationId: string): Promise<{
  line: QuoteWorkTemplateListItem[];
  stage: QuoteWorkTemplateListItem[];
  task: QuoteWorkTemplateListItem[];
}> {
  const all = await listActiveQuoteWorkTemplates(organizationId);
  return {
    line: all.filter((t) => t.kind === QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN),
    stage: all.filter((t) => t.kind === QuoteWorkTemplateKind.STAGE_WITH_TASKS),
    task: all.filter((t) => t.kind === QuoteWorkTemplateKind.TASK),
  };
}

export type TemplateLibraryStatusFilter = "active" | "archived" | "all";

export type QuoteWorkTemplateLibraryListItem = QuoteWorkTemplateListItem & {
  archivedAt: Date | null;
};

export type WorkTemplateLibraryPreview =
  | { kind: "LINE_ITEM_WITH_PLAN"; payload: LineItemWithPlanPayload }
  | { kind: "STAGE_WITH_TASKS"; payload: StageWithTasksPayload }
  | { kind: "TASK"; payload: TaskOnlyPayload };

export type WorkTemplateLibraryDetail = {
  id: string;
  kind: QuoteWorkTemplateKind;
  name: string;
  description: string | null;
  tags: string[];
  contentVersion: number;
  updatedAt: Date;
  archivedAt: Date | null;
  preview: WorkTemplateLibraryPreview;
};

export async function listQuoteWorkTemplatesForLibrary(
  organizationId: string,
  filters: {
    kind?: QuoteWorkTemplateKind;
    search?: string;
    status: TemplateLibraryStatusFilter;
  },
): Promise<QuoteWorkTemplateLibraryListItem[]> {
  const where: Prisma.QuoteWorkTemplateWhereInput = { organizationId };
  if (filters.status === "active") {
    where.archivedAt = null;
  } else if (filters.status === "archived") {
    where.archivedAt = { not: null };
  }
  if (filters.kind) {
    where.kind = filters.kind;
  }
  const q = filters.search?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.quoteWorkTemplate.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      kind: true,
      name: true,
      description: true,
      tagsJson: true,
      contentVersion: true,
      updatedAt: true,
      archivedAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    description: r.description,
    tags: parseTags(r.tagsJson),
    contentVersion: r.contentVersion,
    updatedAt: r.updatedAt,
    archivedAt: r.archivedAt,
  }));
}

export type QuoteWorkTemplateLibraryDetailResult =
  | { ok: true; detail: WorkTemplateLibraryDetail }
  | { ok: false; reason: "not_found" | "invalid_payload" };

export async function resolveQuoteWorkTemplateLibraryDetail(
  organizationId: string,
  templateId: string,
): Promise<QuoteWorkTemplateLibraryDetailResult> {
  const row = await prisma.quoteWorkTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
  if (!row) return { ok: false, reason: "not_found" };

  let preview: WorkTemplateLibraryPreview;
  try {
    if (row.kind === QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN) {
      preview = {
        kind: "LINE_ITEM_WITH_PLAN",
        payload: parseLineItemWithPlanPayload(row.payloadJson),
      };
    } else if (row.kind === QuoteWorkTemplateKind.STAGE_WITH_TASKS) {
      preview = {
        kind: "STAGE_WITH_TASKS",
        payload: parseStageWithTasksPayload(row.payloadJson),
      };
    } else {
      preview = {
        kind: "TASK",
        payload: parseTaskOnlyPayload(row.payloadJson),
      };
    }
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }

  return {
    ok: true,
    detail: {
      id: row.id,
      kind: row.kind,
      name: row.name,
      description: row.description,
      tags: parseTags(row.tagsJson),
      contentVersion: row.contentVersion,
      updatedAt: row.updatedAt,
      archivedAt: row.archivedAt,
      preview,
    },
  };
}
