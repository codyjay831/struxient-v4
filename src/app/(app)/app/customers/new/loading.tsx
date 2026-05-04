import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";

export default function NewCustomerLoading() {
  return (
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-8">
        <div className="animate-pulse space-y-3 border-b border-border/50 pb-6 dark:border-zinc-800/50">
          <div className="h-6 w-40 max-w-full rounded-[6px] bg-muted/50 dark:bg-zinc-900/50" />
          <div className="h-8 w-64 max-w-full rounded-[6px] bg-muted/50 dark:bg-zinc-900/50" />
          <div className="h-4 max-w-2xl rounded-[6px] bg-muted/40 dark:bg-zinc-900/40" />
          <div className="h-4 max-w-xl rounded-[6px] bg-muted/35 dark:bg-zinc-900/35" />
        </div>
        <div className="grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,17rem)]">
          <div className="space-y-6">
            <div className="h-40 rounded-[6px] border border-border/50 bg-muted/20 dark:border-zinc-800/50 dark:bg-zinc-950/30" />
            <div className="h-44 rounded-[6px] border border-border/50 bg-muted/20 dark:border-zinc-800/50 dark:bg-zinc-950/30" />
            <div className="h-10 w-40 rounded-[5px] bg-muted/40 dark:bg-zinc-900/40" />
          </div>
          <div className="h-64 rounded-[6px] border border-border/50 bg-muted/15 dark:border-zinc-800/50 dark:bg-zinc-950/25" />
        </div>
      </div>
    </AppWorkspaceCanvas>
  );
}
