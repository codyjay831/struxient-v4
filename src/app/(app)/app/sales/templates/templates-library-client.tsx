"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuoteWorkTemplateKind } from "@prisma/client";
import type { QuoteActionResult } from "@/server/phase2/quote-mutations";
import type {
  WorkTemplateLibraryPreview,
} from "@/server/phase3/template-queries";
import type {
  LineItemWithPlanPayload,
  StageWithTasksPayload,
  TaskOnlyPayload,
} from "@/server/phase3/template-payloads";
import {
  archiveWorkTemplateFromLibrary,
  restoreWorkTemplateFromLibrary,
  updateWorkTemplateMetadataFromLibrary,
} from "@/app/(app)/app/sales/templates/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type TemplatesLibrarySerializedProps = {
  rows: {
    id: string;
    kind: QuoteWorkTemplateKind;
    name: string;
    description: string | null;
    tags: string[];
    contentVersion: number;
    updatedAt: string;
    archivedAt: string | null;
  }[];
  filters: {
    kind?: QuoteWorkTemplateKind;
    q?: string;
    status: "active" | "archived" | "all";
    selected?: string;
  };
  detail:
    | {
        id: string;
        kind: QuoteWorkTemplateKind;
        name: string;
        description: string | null;
        tags: string[];
        contentVersion: number;
        updatedAt: string;
        archivedAt: string | null;
        preview: WorkTemplateLibraryPreview;
      }
    | { reason: "not_found" | "invalid_payload" }
    | null;
  canManage: boolean;
};

function formatTemplateKindLabel(kind: QuoteWorkTemplateKind): string {
  switch (kind) {
    case QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN:
      return "Line + plan";
    case QuoteWorkTemplateKind.STAGE_WITH_TASKS:
      return "Stage + tasks";
    case QuoteWorkTemplateKind.TASK:
      return "Task";
    default:
      return kind;
  }
}

function buildLibraryHref(p: {
  kind?: QuoteWorkTemplateKind;
  q?: string;
  status: "active" | "archived" | "all";
  selected?: string;
}): string {
  const sp = new URLSearchParams();
  if (p.q?.trim()) sp.set("q", p.q.trim());
  if (p.kind) sp.set("kind", p.kind);
  if (p.status !== "active") sp.set("status", p.status);
  if (p.selected) sp.set("selected", p.selected);
  const s = sp.toString();
  return s ? `/app/sales/templates?${s}` : "/app/sales/templates";
}

function ActionError({ state }: { state: QuoteActionResult | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {state.error}
    </p>
  );
}

function isLineItemWithPlanPreview(
  p: WorkTemplateLibraryPreview,
): p is { kind: "LINE_ITEM_WITH_PLAN"; payload: LineItemWithPlanPayload } {
  return p.kind === QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN;
}

function isStageWithTasksPreview(
  p: WorkTemplateLibraryPreview,
): p is { kind: "STAGE_WITH_TASKS"; payload: StageWithTasksPayload } {
  return p.kind === QuoteWorkTemplateKind.STAGE_WITH_TASKS;
}

function isTaskOnlyPreview(
  p: WorkTemplateLibraryPreview,
): p is { kind: "TASK"; payload: TaskOnlyPayload } {
  return p.kind === QuoteWorkTemplateKind.TASK;
}

function InternalBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
      <p className="font-semibold uppercase tracking-wide text-amber-200/90">{label}</p>
      <div className="mt-1 text-muted-foreground">{children}</div>
    </div>
  );
}

function PreviewBody({ preview }: { preview: WorkTemplateLibraryPreview }) {
  if (isLineItemWithPlanPreview(preview)) {
    const { line, stages } = preview.payload;
      return (
        <div className="space-y-4 text-sm">
          <div className="rounded-sm border border-border bg-zinc-900/50 p-3">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Line defaults</p>
            <p className="mt-1 font-medium text-foreground">{line.title}</p>
            <p className="mt-1 text-muted-foreground">{line.customerDescription}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Qty {line.quantity} · {line.pricingMode.replace(/_/g, " ")} · {line.lineMode.replace(/_/g, " ")}
            </p>
            {line.internalNotes ? (
              <div className="mt-3">
                <InternalBlock label="Internal (staff)">{line.internalNotes}</InternalBlock>
              </div>
            ) : null}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Stages & tasks</p>
            <ul className="mt-2 space-y-3">
              {stages.map((st, i) => (
                <li key={i} className="rounded-sm border border-border/80 bg-background/40 p-3">
                  <p className="font-medium text-foreground">{st.title}</p>
                  {st.internalNotes ? (
                    <div className="mt-2">
                      <InternalBlock label="Internal (staff)">{st.internalNotes}</InternalBlock>
                    </div>
                  ) : null}
                  <ul className="mt-2 space-y-2 border-t border-border/60 pt-2">
                    {st.tasks.map((tk, j) => (
                      <li key={j} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{tk.title}</span>
                        {tk.internalNotes ? (
                          <span className="ml-2 text-amber-200/80">· internal note</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
  }
  if (isStageWithTasksPreview(preview)) {
    const { stage, tasks } = preview.payload;
      return (
        <div className="space-y-3 text-sm">
          <div className="rounded-sm border border-border bg-zinc-900/50 p-3">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Stage</p>
            <p className="mt-1 font-medium text-foreground">{stage.title}</p>
            {stage.internalNotes ? (
              <div className="mt-2">
                <InternalBlock label="Internal (staff)">{stage.internalNotes}</InternalBlock>
              </div>
            ) : null}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Tasks</p>
            <ul className="mt-2 space-y-2">
              {tasks.map((tk, j) => (
                <li key={j} className="rounded-sm border border-border/60 bg-background/30 px-3 py-2 text-xs">
                  <p className="font-medium text-foreground">{tk.title}</p>
                  {tk.description ? <p className="mt-1 text-muted-foreground">{tk.description}</p> : null}
                  {tk.internalNotes ? (
                    <div className="mt-2">
                      <InternalBlock label="Internal (staff)">{tk.internalNotes}</InternalBlock>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
  }
  if (isTaskOnlyPreview(preview)) {
    const tk = preview.payload.task;
      return (
        <div className="rounded-sm border border-border bg-zinc-900/50 p-3 text-sm">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Task</p>
          <p className="mt-1 font-medium text-foreground">{tk.title}</p>
          {tk.description ? <p className="mt-1 text-muted-foreground">{tk.description}</p> : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Required: {tk.isRequired ? "Yes" : "No"}
            {tk.customerVisible ? " · Customer-visible" : ""}
            {tk.customerLabel ? ` · Label: ${tk.customerLabel}` : ""}
          </p>
          {tk.internalNotes ? (
            <div className="mt-3">
              <InternalBlock label="Internal (staff)">{tk.internalNotes}</InternalBlock>
            </div>
          ) : null}
        </div>
      );
  }
  return null;
}

export function TemplatesLibraryClient(props: TemplatesLibrarySerializedProps) {
  const { rows, filters, detail, canManage } = props;
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);

  const [metaState, metaAction] = useActionState(updateWorkTemplateMetadataFromLibrary, undefined);
  const [archiveState, archiveAction] = useActionState(archiveWorkTemplateFromLibrary, undefined);
  const [restoreState, restoreAction] = useActionState(restoreWorkTemplateFromLibrary, undefined);

  useEffect(() => {
    if (metaState?.ok) {
      setEditOpen(false);
      router.refresh();
    }
  }, [metaState?.ok, router]);

  useEffect(() => {
    if (archiveState?.ok) {
      setConfirmArchiveOpen(false);
      router.refresh();
    }
  }, [archiveState?.ok, router]);

  useEffect(() => {
    if (restoreState?.ok) router.refresh();
  }, [restoreState?.ok, router]);

  const detailOk = detail && "preview" in detail;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="space-y-2">
        <Link href="/app/sales/opportunities" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          ← Sales
        </Link>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Work templates</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Reusable starting points for quote line items, stages, and tasks. Quotes receive editable copies; changing a
          template does not update existing quotes.
        </p>
        <p className="text-xs text-muted-foreground">
          Use templates from inside a quote workspace to insert materialized, quote-owned work.
        </p>
      </div>

      <form
        method="get"
        action="/app/sales/templates"
        className="flex flex-col gap-3 rounded-sm border border-border bg-card/10 p-4 md:flex-row md:flex-wrap md:items-end"
      >
        {filters.selected ? <input type="hidden" name="selected" value={filters.selected} /> : null}
        <div className="grid flex-1 gap-2 md:min-w-[200px]">
          <Label htmlFor="tmpl-search" className="text-xs text-muted-foreground">
            Search name or description
          </Label>
          <Input
            id="tmpl-search"
            name="q"
            key={filters.q ?? ""}
            defaultValue={filters.q ?? ""}
            className="rounded-sm"
            placeholder="Search…"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tmpl-kind" className="text-xs text-muted-foreground">
            Kind
          </Label>
          <select
            id="tmpl-kind"
            name="kind"
            defaultValue={filters.kind ?? "all"}
            className="h-9 rounded-sm border border-input bg-background px-2 text-sm"
          >
            <option value="all">All kinds</option>
            <option value={QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN}>Line + plan</option>
            <option value={QuoteWorkTemplateKind.STAGE_WITH_TASKS}>Stage + tasks</option>
            <option value={QuoteWorkTemplateKind.TASK}>Task</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tmpl-status" className="text-xs text-muted-foreground">
            Status
          </Label>
          <select
            id="tmpl-status"
            name="status"
            defaultValue={filters.status}
            className="h-9 rounded-sm border border-input bg-background px-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>
        <Button type="submit" size="sm" className="rounded-sm md:mb-0.5">
          Apply filters
        </Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="min-w-0 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Library</h2>
          {rows.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-muted/5 px-4 py-10 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No templates match these filters.</p>
              <p className="mt-2 leading-relaxed">
                Save a line, stage, or task as a template from a quote workspace, or widen filters to see archived
                items.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-sm border border-border">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Kind</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const active = filters.selected === r.id;
                    return (
                      <tr key={r.id} className={cn("border-b border-border/80", active && "bg-primary/5")}>
                        <td className="px-3 py-2 align-top">
                          <Link
                            href={buildLibraryHref({ ...filters, selected: r.id })}
                            className="font-medium text-primary hover:underline"
                          >
                            {r.name}
                          </Link>
                          {r.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                          ) : null}
                          {r.tags.length ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">{r.tags.join(" · ")}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-muted-foreground">{formatTemplateKindLabel(r.kind)}</td>
                        <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-muted-foreground">
                          {new Date(r.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        <td className="px-3 py-2 align-top text-xs">
                          {r.archivedAt ? (
                            <span className="rounded-sm border border-border px-1.5 py-0.5 text-muted-foreground">
                              Archived
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Active</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-3 rounded-sm border border-border bg-card/10 p-4">
          <h2 className="text-sm font-semibold text-foreground">Preview & actions</h2>
          {!filters.selected ? (
            <p className="text-sm text-muted-foreground">Select a template from the list to inspect its structure.</p>
          ) : detail && "reason" in detail ? (
            <p className="text-sm text-destructive" role="status">
              {detail.reason === "not_found"
                ? "Template not found in this organization."
                : "This template’s stored payload failed validation and cannot be previewed."}
            </p>
          ) : detailOk && detail ? (
            <div className="space-y-4">
              <div>
                <p className="text-base font-semibold text-foreground">{detail.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatTemplateKindLabel(detail.kind)} · Content version {detail.contentVersion}
                </p>
                {detail.description ? <p className="mt-2 text-sm text-muted-foreground">{detail.description}</p> : null}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Updated {new Date(detail.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <PreviewBody preview={detail.preview} />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Changing this template does not update existing quotes. Customer preview never exposes template names or
                tags.
              </p>
              {canManage ? (
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button type="button" size="sm" variant="secondary" className="rounded-sm" onClick={() => setEditOpen(true)}>
                    Edit metadata
                  </Button>
                  {!detail.archivedAt ? (
                    <Button type="button" size="sm" variant="outline" className="rounded-sm" onClick={() => setConfirmArchiveOpen(true)}>
                      Archive
                    </Button>
                  ) : (
                    <form action={restoreAction}>
                      <input type="hidden" name="templateId" value={detail.id} />
                      <Button type="submit" size="sm" className="rounded-sm">
                        Restore
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Only owners, administrators, and managers can edit metadata, archive, or restore templates.
                </p>
              )}
              <ActionError state={restoreState} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-lg border-border bg-zinc-950 text-foreground">
              {detailOk && detail ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Edit template metadata</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Name, description, and tags only. Payload and content version are unchanged.
                    </DialogDescription>
                  </DialogHeader>
                  <form action={metaAction} className="grid gap-4">
                    <input type="hidden" name="templateId" value={detail.id} />
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Name</Label>
                      <Input id="edit-name" name="name" required className="rounded-sm" defaultValue={detail.name} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-desc">Description</Label>
                      <Textarea
                        id="edit-desc"
                        name="description"
                        rows={3}
                        className="rounded-sm"
                        defaultValue={detail.description ?? ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                      <Input id="edit-tags" name="tags" className="rounded-sm" defaultValue={detail.tags.join(", ")} />
                    </div>
                    <ActionError state={metaState} />
                    <DialogFooter className="gap-2">
                      <Button type="button" variant="outline" size="sm" className="rounded-sm" onClick={() => setEditOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" className="rounded-sm">
                        Save metadata
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
            <DialogContent className="max-w-md border-border bg-zinc-950 text-foreground">
              <DialogHeader>
                <DialogTitle>Archive template</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Archived templates no longer appear in quote insert pickers until restored. Existing quotes are
                  unchanged.
                </DialogDescription>
              </DialogHeader>
              {detailOk && detail ? (
                <form action={archiveAction} className="space-y-4">
                  <input type="hidden" name="templateId" value={detail.id} />
                  <ActionError state={archiveState} />
                  <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-sm" onClick={() => setConfirmArchiveOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" variant="destructive" className="rounded-sm">
                      Archive template
                    </Button>
                  </DialogFooter>
                </form>
              ) : null}
            </DialogContent>
          </Dialog>
        </aside>
      </div>
    </div>
  );
}
