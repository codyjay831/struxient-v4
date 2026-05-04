import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";

export default function CustomersLoading() {
  return (
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-8">
        <div className="animate-pulse space-y-6">
          <div className="space-y-3 border-b border-border/50 pb-6 dark:border-zinc-800/50">
            <div className="h-8 w-48 max-w-full rounded-[6px] bg-muted/50 dark:bg-zinc-900/50" />
            <div className="h-4 w-full max-w-2xl rounded-[6px] bg-muted/40 dark:bg-zinc-900/40" />
            <div className="h-9 w-36 rounded-[5px] bg-muted/50 dark:bg-zinc-900/50" />
          </div>
          <div className="space-y-0 overflow-hidden rounded-[6px] border border-border dark:border-zinc-800/60">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[5.5rem] border-b border-border/60 last:border-b-0 dark:border-zinc-800/40" />
            ))}
          </div>
        </div>
      </div>
    </AppWorkspaceCanvas>
  );
}
