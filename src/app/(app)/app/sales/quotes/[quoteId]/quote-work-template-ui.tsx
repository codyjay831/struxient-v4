"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QuoteWorkTemplateKind } from "@prisma/client";
import {
  archiveQuoteWorkTemplate,
  insertLineItemTemplateIntoQuote,
  insertStageTemplateIntoLine,
  insertTaskTemplateIntoStage,
  saveExecutionTaskAsTemplate,
  saveLineItemAsTemplate,
  saveStageAsTemplate,
} from "@/app/(app)/app/sales/quotes/actions";
type TemplateUiActionState =
  | { ok: true; quoteId?: string; opportunityId?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  workspaceDialogContentClass,
  workspaceInputClass,
  workspaceTextareaClass,
} from "@/components/workspace/workspace-form-controls";
import { workspaceDashedEmptyWellClass } from "@/components/workspace/workspace-surface-tokens";
import { cn } from "@/lib/utils";

export type WorkTemplateListItemDTO = {
  id: string;
  kind: QuoteWorkTemplateKind;
  name: string;
  description: string | null;
  tags: string[];
  contentVersion: number;
  updatedAt: string;
};

export type WorkTemplatesBundleDTO = {
  line: WorkTemplateListItemDTO[];
  stage: WorkTemplateListItemDTO[];
  task: WorkTemplateListItemDTO[];
};

function ActionError({ state }: { state: TemplateUiActionState | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="text-sm font-medium text-destructive dark:text-red-400" role="alert">
      {state.error}
    </p>
  );
}

function formatTemplateDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

type InsertKind = "line" | "stage" | "task";

export function WorkTemplateInsertDialog(props: {
  quoteId: string;
  insertKind: InsertKind;
  lineItemId?: string;
  stageId?: string;
  items: WorkTemplateListItemDTO[];
  /** Archive from the picker is restricted to owner/admin/manager; inserts remain for all quote authors. */
  canManageTemplates: boolean;
  trigger: React.ReactNode;
  title: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const { quoteId, insertKind, lineItemId, stageId, items, canManageTemplates, trigger, title, emptyTitle, emptyBody } =
    props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [lineState, lineInsert] = useActionState(insertLineItemTemplateIntoQuote, undefined);
  const [stageState, stageInsert] = useActionState(insertStageTemplateIntoLine, undefined);
  const [taskState, taskInsert] = useActionState(insertTaskTemplateIntoStage, undefined);
  const [archiveState, archiveAction] = useActionState(archiveQuoteWorkTemplate, undefined);

  useEffect(() => {
    if (lineState?.ok || stageState?.ok || taskState?.ok) {
      router.refresh();
      setOpen(false);
      setSelectedId(null);
    }
  }, [lineState?.ok, stageState?.ok, taskState?.ok, router]);

  useEffect(() => {
    if (archiveState?.ok) {
      router.refresh();
    }
  }, [archiveState?.ok, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={cn(workspaceDialogContentClass(), "max-h-[85vh] max-w-lg min-w-0 overflow-y-auto overflow-x-hidden")}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground dark:text-zinc-500">
            Adds an editable copy to this quote. The template stays unchanged. This quote owns the inserted work.
          </DialogDescription>
        </DialogHeader>
        {items.length === 0 ? (
          <div className={workspaceDashedEmptyWellClass()}>
            <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{emptyBody}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
              {items.map((t) => (
                <li
                  key={t.id}
                  className={cn(
                    "rounded-[6px] border border-border bg-muted/30 p-3 transition-colors dark:border-zinc-800/60 dark:bg-zinc-950/25",
                    selectedId === t.id ? "border-primary/60 ring-1 ring-primary/30" : "hover:border-border/80",
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedId(t.id)}
                  >
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    {t.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                    ) : null}
                    {t.tags.length ? (
                      <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t.tags.join(" · ")}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-muted-foreground">Updated {formatTemplateDate(t.updatedAt)}</p>
                  </button>
                  {canManageTemplates ? (
                    <form action={archiveAction} className="mt-2 flex justify-end border-t border-border/60 pt-2">
                      <input type="hidden" name="quoteId" value={quoteId} />
                      <input type="hidden" name="templateId" value={t.id} />
                      <Button type="submit" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
                        Archive template
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {insertKind === "line" ? (
              <form action={lineInsert} className="space-y-3 border-t border-border pt-3">
                <input type="hidden" name="quoteId" value={quoteId} />
                <input type="hidden" name="templateId" value={selectedId ?? ""} />
                <ActionError state={lineState} />
                <DialogFooter className="gap-2 sm:justify-between">
                  <Button type="button" variant="outline" size="sm" className="rounded-[5px] font-semibold" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="rounded-[5px] font-semibold" disabled={!selectedId}>
                    Insert selected
                  </Button>
                </DialogFooter>
              </form>
            ) : insertKind === "stage" ? (
              <form action={stageInsert} className="space-y-3 border-t border-border pt-3">
                <input type="hidden" name="quoteId" value={quoteId} />
                <input type="hidden" name="lineItemId" value={lineItemId ?? ""} />
                <input type="hidden" name="templateId" value={selectedId ?? ""} />
                <ActionError state={stageState} />
                <DialogFooter className="gap-2 sm:justify-between">
                  <Button type="button" variant="outline" size="sm" className="rounded-[5px] font-semibold" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="rounded-[5px] font-semibold" disabled={!selectedId}>
                    Insert selected
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <form action={taskInsert} className="space-y-3 border-t border-border pt-3">
                <input type="hidden" name="quoteId" value={quoteId} />
                <input type="hidden" name="stageId" value={stageId ?? ""} />
                <input type="hidden" name="templateId" value={selectedId ?? ""} />
                <ActionError state={taskState} />
                <DialogFooter className="gap-2 sm:justify-between">
                  <Button type="button" variant="outline" size="sm" className="rounded-[5px] font-semibold" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="rounded-[5px] font-semibold" disabled={!selectedId}>
                    Insert selected
                  </Button>
                </DialogFooter>
              </form>
            )}
            {canManageTemplates ? <ActionError state={archiveState} /> : null}
          </div>
        )}
        {!items.length ? (
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" className="rounded-[5px] font-semibold" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type SaveKind = "line" | "stage" | "task";

export function SaveWorkTemplateDialog(props: {
  quoteId: string;
  saveKind: SaveKind;
  lineItemId?: string;
  stageId?: string;
  taskId?: string;
  trigger: React.ReactNode;
  defaultName?: string;
}) {
  const { quoteId, saveKind, lineItemId, stageId, taskId, trigger, defaultName } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [lineState, lineSave] = useActionState(saveLineItemAsTemplate, undefined);
  const [stageState, stageSave] = useActionState(saveStageAsTemplate, undefined);
  const [taskState, taskSave] = useActionState(saveExecutionTaskAsTemplate, undefined);

  const state = saveKind === "line" ? lineState : saveKind === "stage" ? stageState : taskState;

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      setOpen(false);
    }
  }, [state?.ok, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn(workspaceDialogContentClass(), "min-w-0 max-w-lg overflow-x-hidden")}>
        <DialogHeader>
          <DialogTitle>Save as work template</DialogTitle>
          <DialogDescription className="space-y-2 text-muted-foreground dark:text-zinc-500">
            <span className="block">
              Saves this as a reusable starting point. Existing quotes will not be linked to this template. Editing this
              quote later will not change the template.
            </span>
          </DialogDescription>
        </DialogHeader>
        {saveKind === "line" ? (
          <form action={lineSave} className="grid gap-4">
            <input type="hidden" name="quoteId" value={quoteId} />
            <input type="hidden" name="lineItemId" value={lineItemId ?? ""} />
            <div className="space-y-2">
              <Label htmlFor="tmpl-name-line">Template name</Label>
              <Input
                id="tmpl-name-line"
                name="name"
                required
                className={cn(workspaceInputClass(), "min-w-0")}
                placeholder="e.g. Standard EV charger install"
                defaultValue={defaultName ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tmpl-desc-line">Description (optional)</Label>
              <Textarea
                id="tmpl-desc-line"
                name="description"
                rows={2}
                className={cn(workspaceTextareaClass(), "min-h-[4rem] min-w-0 resize-y")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tmpl-tags-line">Tags (optional, comma-separated)</Label>
              <Input id="tmpl-tags-line" name="tags" className={cn(workspaceInputClass(), "min-w-0")} placeholder="electrical, ev" />
            </div>
            <ActionError state={lineState} />
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" className="rounded-[5px] font-semibold" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="rounded-[5px] font-semibold">
                Save template
              </Button>
            </DialogFooter>
          </form>
        ) : saveKind === "stage" ? (
          <form action={stageSave} className="grid gap-4">
            <input type="hidden" name="quoteId" value={quoteId} />
            <input type="hidden" name="lineItemId" value={lineItemId ?? ""} />
            <input type="hidden" name="stageId" value={stageId ?? ""} />
            <div className="space-y-2">
              <Label htmlFor="tmpl-name-stage">Template name</Label>
              <Input
                id="tmpl-name-stage"
                name="name"
                required
                className={cn(workspaceInputClass(), "min-w-0")}
                defaultValue={defaultName ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tmpl-desc-stage">Description (optional)</Label>
              <Textarea
                id="tmpl-desc-stage"
                name="description"
                rows={2}
                className={cn(workspaceTextareaClass(), "min-h-[4rem] min-w-0 resize-y")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tmpl-tags-stage">Tags (optional)</Label>
              <Input id="tmpl-tags-stage" name="tags" className={cn(workspaceInputClass(), "min-w-0")} />
            </div>
            <ActionError state={stageState} />
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" className="rounded-[5px] font-semibold" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="rounded-[5px] font-semibold">
                Save template
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form action={taskSave} className="grid gap-4">
            <input type="hidden" name="quoteId" value={quoteId} />
            <input type="hidden" name="stageId" value={stageId ?? ""} />
            <input type="hidden" name="taskId" value={taskId ?? ""} />
            <div className="space-y-2">
              <Label htmlFor="tmpl-name-task">Template name</Label>
              <Input
                id="tmpl-name-task"
                name="name"
                required
                className={cn(workspaceInputClass(), "min-w-0")}
                defaultValue={defaultName ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tmpl-desc-task">Description (optional)</Label>
              <Textarea
                id="tmpl-desc-task"
                name="description"
                rows={2}
                className={cn(workspaceTextareaClass(), "min-h-[4rem] min-w-0 resize-y")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tmpl-tags-task">Tags (optional)</Label>
              <Input id="tmpl-tags-task" name="tags" className={cn(workspaceInputClass(), "min-w-0")} />
            </div>
            <ActionError state={taskState} />
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" className="rounded-[5px] font-semibold" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="rounded-[5px] font-semibold">
                Save template
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
