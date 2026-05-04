import Link from "next/link";
import { notFound } from "next/navigation";
import { canViewWorkStation } from "@/lib/phase6-permissions";
import { requireOrgSession } from "@/server/phase1/org-session";
import { getWorkStationFeed, parseWorkStationFeedFilters } from "@/server/phase6/work-station-feed";
import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";
import { WorkspaceCommandHeader } from "@/components/workspace/workspace-command-header";
import { Button } from "@/components/ui/button";
import { WorkStationFeedUi } from "./work-station-feed-ui";

export default async function WorkStationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrgSession();
  if (!canViewWorkStation(ctx.role)) {
    notFound();
  }

  const sp = await searchParams;
  const filters = parseWorkStationFeedFilters(sp);
  const { cards, countsByCategory, cardsAfterSourceFilter } = await getWorkStationFeed(ctx, filters);

  return (
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-8">
        <WorkspaceCommandHeader
          eyebrow="Operations"
          title="Work Station"
          description="A compact decision queue for your role: items are ordered by category, priority, and recency from existing Struxient signals — not crew capacity or AI scoring. Use filters to narrow sources, then open the primary action on each row."
          actions={
            <div className="flex min-w-0 flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-[5px] font-semibold">
                <Link href="/app/schedule">Schedule</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-[5px] font-semibold">
                <Link href="/app/jobs">Jobs</Link>
              </Button>
            </div>
          }
        />

        <WorkStationFeedUi
          cards={cards}
          countsByCategory={countsByCategory}
          activeCategory={filters.category}
          activeSource={filters.source}
          totalCapped={cardsAfterSourceFilter}
        />
      </div>
    </AppWorkspaceCanvas>
  );
}
