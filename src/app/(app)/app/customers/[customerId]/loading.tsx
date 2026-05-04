import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";

export default function CustomerDetailLoading() {
  return (
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-8">
        <div className="animate-pulse space-y-4 border-b border-border/50 pb-6 dark:border-zinc-800/50">
          <div className="h-5 w-32 rounded-[6px] bg-muted/45 dark:bg-zinc-900/45" />
          <div className="h-9 w-72 max-w-full rounded-[6px] bg-muted/50 dark:bg-zinc-900/50" />
          <div className="h-4 w-full max-w-2xl rounded-[6px] bg-muted/35 dark:bg-zinc-900/35" />
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-[4px] bg-muted/40 dark:bg-zinc-900/40" />
            <div className="h-6 w-16 rounded-[4px] bg-muted/40 dark:bg-zinc-900/40" />
          </div>
        </div>
        <div className="grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,17rem)]">
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-[6px] border border-border/50 bg-muted/15 dark:border-zinc-800/50 dark:bg-zinc-950/25" />
            ))}
          </div>
          <div className="h-56 rounded-[6px] border border-border/50 bg-muted/15 dark:border-zinc-800/50 dark:bg-zinc-950/25" />
        </div>
      </div>
    </AppWorkspaceCanvas>
  );
}
