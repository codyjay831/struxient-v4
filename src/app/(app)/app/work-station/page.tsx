import { notFound } from "next/navigation";
import { canViewWorkStation } from "@/lib/phase6-permissions";
import { requireOrgSession } from "@/server/phase1/org-session";
import { getWorkStationFeed, parseWorkStationFeedFilters } from "@/server/phase6/work-station-feed";
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
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Work Station</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Role-aware work that needs attention now, with reasons and links back to the source.
        </p>
      </div>

      <WorkStationFeedUi
        cards={cards}
        countsByCategory={countsByCategory}
        activeCategory={filters.category}
        activeSource={filters.source}
        totalCapped={cardsAfterSourceFilter}
      />
    </div>
  );
}
