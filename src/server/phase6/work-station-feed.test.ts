import { describe, expect, it } from "vitest";
import { canViewWorkStation } from "@/lib/phase6-permissions";
import { MembershipRole } from "@prisma/client";
import {
  parseWorkStationFeedFilters,
  sortWorkStationCards,
  workStationFilterCardsByCategory,
  workStationFilterCardsBySource,
} from "@/server/phase6/work-station-feed";
import type { WorkStationCard } from "@/server/phase6/work-station-card-types";

describe("parseWorkStationFeedFilters", () => {
  it("defaults invalid source to all", () => {
    expect(parseWorkStationFeedFilters({ source: "bogus" }).source).toBe("all");
  });

  it("parses valid source and category", () => {
    expect(parseWorkStationFeedFilters({ source: "quotes", category: "blocked" })).toEqual({
      source: "quotes",
      category: "blocked",
    });
  });

  it("handles array search param values", () => {
    expect(parseWorkStationFeedFilters({ source: ["jobs"], category: ["now"] })).toEqual({
      source: "jobs",
      category: "now",
    });
  });
});

describe("sortWorkStationCards", () => {
  it("sorts by category, then priority, then updatedAt desc, then id", () => {
    const cards: WorkStationCard[] = [
      {
        id: "b",
        category: "NEXT",
        priority: "LOW",
        sourceType: "QUOTE",
        sourceId: "q1",
        title: "t",
        reason: "r",
        primaryActionLabel: "Open",
        primaryHref: "/x",
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
      {
        id: "a",
        category: "NOW",
        priority: "NORMAL",
        sourceType: "QUOTE",
        sourceId: "q2",
        title: "t",
        reason: "r",
        primaryActionLabel: "Open",
        primaryHref: "/x",
        updatedAt: "2019-01-01T00:00:00.000Z",
      },
      {
        id: "c",
        category: "NOW",
        priority: "HIGH",
        sourceType: "QUOTE",
        sourceId: "q3",
        title: "t",
        reason: "r",
        primaryActionLabel: "Open",
        primaryHref: "/x",
        updatedAt: "2021-01-01T00:00:00.000Z",
      },
    ];
    const sorted = sortWorkStationCards(cards);
    expect(sorted.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });
});

describe("workStationFilterCardsBySource", () => {
  it("filters quotes only", () => {
    const cards: WorkStationCard[] = [
      {
        id: "1",
        category: "NOW",
        priority: "NORMAL",
        sourceType: "QUOTE",
        sourceId: "q",
        title: "t",
        reason: "r",
        primaryActionLabel: "Open",
        primaryHref: "/app/sales/quotes/q",
      },
      {
        id: "2",
        category: "NOW",
        priority: "NORMAL",
        sourceType: "JOB",
        sourceId: "j",
        title: "t",
        reason: "r",
        primaryActionLabel: "Open",
        primaryHref: "/app/jobs/j",
      },
    ];
    expect(workStationFilterCardsBySource(cards, "quotes")).toHaveLength(1);
    expect(workStationFilterCardsBySource(cards, "jobs")).toHaveLength(1);
  });
});

describe("workStationFilterCardsByCategory", () => {
  it("filters by category", () => {
    const cards: WorkStationCard[] = [
      {
        id: "1",
        category: "BLOCKED",
        priority: "NORMAL",
        sourceType: "QUOTE",
        sourceId: "q",
        title: "t",
        reason: "r",
        primaryActionLabel: "Open",
        primaryHref: "/x",
      },
      {
        id: "2",
        category: "NOW",
        priority: "NORMAL",
        sourceType: "QUOTE",
        sourceId: "q2",
        title: "t",
        reason: "r",
        primaryActionLabel: "Open",
        primaryHref: "/x",
      },
    ];
    expect(workStationFilterCardsByCategory(cards, "blocked")).toHaveLength(1);
  });
});

describe("canViewWorkStation", () => {
  it("denies MEMBER", () => {
    expect(canViewWorkStation(MembershipRole.MEMBER)).toBe(false);
  });

  it("allows operational roles", () => {
    expect(canViewWorkStation(MembershipRole.SALES)).toBe(true);
    expect(canViewWorkStation(MembershipRole.FIELD_WORKER)).toBe(true);
  });
});
