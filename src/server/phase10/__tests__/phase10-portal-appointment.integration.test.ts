/**
 * Phase 10: appointment acknowledgment + portal POST rate limits.
 * Requires DATABASE_URL and PostgreSQL.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  CustomerContactType,
  CustomerPortalSubmissionStatus,
  CustomerPortalSubmissionType,
  MembershipRole,
  OpportunityPriority,
  OpportunityStatus,
  OpportunityTaskKind,
  OpportunityTaskStatus,
  PricingMode,
  QuoteLineMode,
  QuoteTaskStatus,
  ScheduledWorkStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import {
  quoteMutationAddLineItem,
  quoteMutationCreateDraftFromOpportunity,
  quoteMutationMarkReadyToSend,
  quoteMutationMarkSent,
} from "@/server/phase2/quote-mutations";
import { quoteMutationActivateAcceptedQuoteAsJob, quoteMutationMarkAccepted } from "@/server/phase4/quote-accept-activate";
import { getPortalViewByRawToken } from "@/server/phase8/portal-projection";
import { hashPortalToken } from "@/server/phase8/portal-token-crypto";
import { createPortalAccessTokenForQuote, revokeActivePortalTokenForQuote } from "@/server/phase8/portal-token-mutations";
import { jobMutationCancelScheduledWork, jobMutationScheduleJobTask } from "@/server/phase7/scheduled-work-mutations";
import { confirmScheduledWorkFromPortal } from "@/server/phase10/portal-appointment-confirmation";
import { createPortalSubmissionFromToken } from "@/server/phase9/portal-submission-actions";
import { signScheduleActionRef } from "@/server/phase10/schedule-action-ref-crypto";
import {
  computePortalRateLimitWindowStart,
  consumePortalPostRateLimitSlot,
  PORTAL_POST_RATE_LIMIT_MAX,
  PortalPostRateLimitedError,
} from "@/server/phase10/portal-post-rate-limit";
import { listCustomerPortalSubmissionsForJob } from "@/server/phase9/customer-portal-submission-queries";
import { getWorkStationFeed, parseWorkStationFeedFilters } from "@/server/phase6/work-station-feed";

config({ path: ".env" });

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) f.set(k, v);
  return f;
}

describe("Phase 10 portal appointment + rate limit (integration)", () => {
  let orgAId: string;
  let userSalesAId: string;
  let userOfficeAId: string;
  let userCrewAId: string;
  let customerAId: string;
  let salesCtxA: OrgSessionContext;
  let officeCtxA: OrgSessionContext;
  let crewCtxA: OrgSessionContext;
  const suffix = `p10-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("phase10-portal-pass-12", 8);

    const orgA = await prisma.organization.create({
      data: { name: `Org P10 ${suffix}`, slug: `org-p10-${suffix}` },
    });
    orgAId = orgA.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-p10-${suffix}@test.local`, passwordHash, name: "Sales P10" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-p10-${suffix}@test.local`, passwordHash, name: "Office P10" },
    });
    const userCrewA = await prisma.user.create({
      data: { email: `crew-p10-${suffix}@test.local`, passwordHash, name: "Crew P10" },
    });
    userSalesAId = userSalesA.id;
    userOfficeAId = userOfficeA.id;
    userCrewAId = userCrewA.id;

    await prisma.membership.create({
      data: { userId: userSalesAId, organizationId: orgAId, role: MembershipRole.SALES },
    });
    await prisma.membership.create({
      data: { userId: userOfficeAId, organizationId: orgAId, role: MembershipRole.OFFICE },
    });
    await prisma.membership.create({
      data: { userId: userCrewAId, organizationId: orgAId, role: MembershipRole.FIELD_WORKER },
    });

    salesCtxA = {
      userId: userSalesAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.SALES,
      email: userSalesA.email!,
      name: userSalesA.name,
    };
    officeCtxA = {
      userId: userOfficeAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.OFFICE,
      email: userOfficeA.email!,
      name: userOfficeA.name,
    };
    crewCtxA = {
      userId: userCrewAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.FIELD_WORKER,
      email: userCrewA.email!,
      name: userCrewA.name,
    };

    const customerA = await prisma.customer.create({
      data: { organizationId: orgAId, displayName: `Customer P10 ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-p10-${suffix}@example.com`,
        isPrimary: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgAId } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [userSalesAId, userOfficeAId, userCrewAId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function seedActivatedJobWithSchedule(params: { startIso: string; endIso: string }) {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp P10 ${suffix}`,
        serviceType: "Remodel",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Scope",
      },
    });
    await prisma.opportunityTask.create({
      data: {
        opportunityId: opp.id,
        title: "Opt",
        kind: OpportunityTaskKind.INTAKE,
        status: OpportunityTaskStatus.NOT_READY,
        isRequired: false,
      },
    });

    const c = await quoteMutationCreateDraftFromOpportunity(salesCtxA, opp.id);
    expect(c.ok && c.outcome === "created").toBe(true);
    if (!c.ok || c.outcome !== "created") throw new Error("draft");
    const quoteId = c.quoteId;

    await quoteMutationAddLineItem(
      salesCtxA,
      fd({
        quoteId,
        title: "Line A",
        customerDescription: "Work A",
        quantity: "1",
        unitPriceCents: "10000",
        pricingMode: PricingMode.FIXED_PRICE,
        lineMode: QuoteLineMode.REQUIRED,
      }),
    );
    const li = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    const st = await prisma.quoteLineExecutionStage.create({
      data: { organizationId: orgAId, quoteLineItemId: li.id, title: "Stage 1", sortOrder: 0 },
    });
    await prisma.quoteLineExecutionTask.create({
      data: {
        organizationId: orgAId,
        stageId: st.id,
        title: "Internal task title",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 0,
        customerVisible: true,
        customerLabel: "Customer milestone",
      },
    });

    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    const act = await quoteMutationActivateAcceptedQuoteAsJob(officeCtxA, fd({ quoteId }));
    expect(act.ok).toBe(true);
    if (!act.ok) throw new Error("activate");
    const jobId = act.jobId;
    if (!jobId) throw new Error("jobId");

    const tasks = await prisma.jobTask.findMany({ where: { jobId }, orderBy: { sortOrder: "asc" } });
    const t0 = tasks[0]!;
    await prisma.jobTask.update({
      where: { id: t0.id },
      data: { customerVisible: true, customerLabel: "Customer milestone" },
    });

    const sch = await jobMutationScheduleJobTask(
      officeCtxA,
      fd({
        jobId,
        jobTaskId: t0.id,
        scheduledStartAt: params.startIso,
        scheduledEndAt: params.endIso,
        title: "Visit",
      }),
    );
    expect(sch.ok).toBe(true);
    if (!sch.ok) throw new Error("schedule");
    const sw = await prisma.scheduledWork.findFirstOrThrow({
      where: { organizationId: orgAId, jobId, jobTaskId: t0.id, status: ScheduledWorkStatus.SCHEDULED },
    });

    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("portal");
    const rawToken = created.portalPath!.slice("/portal/".length);
    const tokenRow = await prisma.portalAccessToken.findFirstOrThrow({ where: { quoteId, revokedAt: null } });

    return { oppId: opp.id, quoteId, jobId, rawToken, scheduledWorkId: sw.id, portalAccessTokenId: tokenRow.id };
  }

  it("portal schedule exposes scheduleActionRef for eligible row; not for canceled", async () => {
    await prisma.portalActionRateLimit.deleteMany({});

    const start = new Date(Date.now() + 86400_000).toISOString();
    const end = new Date(Date.now() + 90000_000).toISOString();
    const { oppId, rawToken, scheduledWorkId } = await seedActivatedJobWithSchedule({
      startIso: start,
      endIso: end,
    });

    const view1 = await getPortalViewByRawToken(rawToken);
    expect(view1?.schedule.length).toBe(1);
    expect(view1?.schedule[0]?.scheduleActionRef).toBeTruthy();
    expect(view1?.schedule[0]?.isCanceled).toBe(false);

    const swRow = await prisma.scheduledWork.findFirstOrThrow({ where: { id: scheduledWorkId } });
    await jobMutationCancelScheduledWork(
      officeCtxA,
      fd({ scheduledWorkId: swRow.id, cancelReason: "Internal test cancel" }),
    );

    const view2 = await getPortalViewByRawToken(rawToken);
    expect(view2?.schedule[0]?.isCanceled).toBe(true);
    expect(view2?.schedule[0]?.scheduleActionRef).toBeUndefined();

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
    await prisma.portalActionRateLimit.deleteMany({});
  });

  it("confirm creates APPOINTMENT_CONFIRMATION; blocks duplicate NEW; no ScheduledWork mutation", async () => {
    await prisma.portalActionRateLimit.deleteMany({});

    const start = new Date(Date.now() + 120_000).toISOString();
    const end = new Date(Date.now() + 240_000).toISOString();
    const { oppId, quoteId, jobId, rawToken, scheduledWorkId, portalAccessTokenId } =
      await seedActivatedJobWithSchedule({ startIso: start, endIso: end });

    const view = await getPortalViewByRawToken(rawToken);
    const ref = view?.schedule[0]?.scheduleActionRef;
    expect(ref).toBeTruthy();

    const swBefore = await prisma.scheduledWork.findFirstOrThrow({ where: { id: scheduledWorkId } });
    const updatedAtBefore = swBefore.updatedAt.getTime();

    const r1 = await confirmScheduledWorkFromPortal({ rawToken, scheduleActionRef: ref! });
    expect(r1.ok).toBe(true);

    const sub = await prisma.customerPortalSubmission.findFirstOrThrow({
      where: { scheduledWorkId, type: CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION },
    });
    expect(sub.status).toBe(CustomerPortalSubmissionStatus.NEW);
    expect(sub.portalAccessTokenId).toBe(portalAccessTokenId);
    expect(sub.jobId).toBe(jobId);
    expect(sub.quoteId).toBe(quoteId);

    const swAfter = await prisma.scheduledWork.findFirstOrThrow({ where: { id: scheduledWorkId } });
    expect(swAfter.updatedAt.getTime()).toBe(updatedAtBefore);

    const r2 = await confirmScheduledWorkFromPortal({ rawToken, scheduleActionRef: ref! });
    expect(r2.ok).toBe(false);

    const staffRows = await listCustomerPortalSubmissionsForJob(officeCtxA, jobId);
    const appt = staffRows.find((x) => x.id === sub.id);
    expect(appt?.scheduledWork).toBeTruthy();

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
    await prisma.portalActionRateLimit.deleteMany({});
  });

  it("invalid token, revoked token, bad ref, past window, hidden task ref fail closed", async () => {
    await prisma.portalActionRateLimit.deleteMany({});

    const start = new Date(Date.now() + 300_000).toISOString();
    const end = new Date(Date.now() + 420_000).toISOString();
    const { oppId, quoteId, jobId, rawToken, scheduledWorkId, portalAccessTokenId } =
      await seedActivatedJobWithSchedule({ startIso: start, endIso: end });

    const ref = signScheduleActionRef({
      scheduledWorkId,
      portalAccessTokenId,
      organizationId: orgAId,
    });

    expect(
      await confirmScheduledWorkFromPortal({ rawToken: "bogus-token", scheduleActionRef: ref }),
    ).toEqual(expect.objectContaining({ ok: false }));

    await revokeActivePortalTokenForQuote(officeCtxA, quoteId);
    expect(await confirmScheduledWorkFromPortal({ rawToken, scheduleActionRef: ref })).toEqual(
      expect.objectContaining({ ok: false }),
    );

    const created2 = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created2.ok).toBe(true);
    if (!created2.ok) return;
    const raw2 = created2.portalPath!.slice("/portal/".length);
    const token2 = await prisma.portalAccessToken.findFirstOrThrow({ where: { quoteId, revokedAt: null } });

    expect(
      await confirmScheduledWorkFromPortal({
        rawToken: raw2,
        scheduleActionRef: signScheduleActionRef({
          scheduledWorkId,
          portalAccessTokenId,
          organizationId: orgAId,
        }),
      }),
    ).toEqual(expect.objectContaining({ ok: false }));

    expect(
      await confirmScheduledWorkFromPortal({
        rawToken: raw2,
        scheduleActionRef: signScheduleActionRef({
          scheduledWorkId,
          portalAccessTokenId: token2.id,
          organizationId: orgAId,
        }),
        now: new Date(new Date(end).getTime() + 86_400_000),
      }),
    ).toEqual(expect.objectContaining({ ok: false }));

    const tasks = await prisma.jobTask.findMany({ where: { jobId }, orderBy: { sortOrder: "asc" } });
    const t0 = tasks[0]!;
    await prisma.jobTask.update({
      where: { id: t0.id },
      data: { customerVisible: false, customerLabel: null },
    });
    const refNewToken = signScheduleActionRef({
      scheduledWorkId,
      portalAccessTokenId: token2.id,
      organizationId: orgAId,
    });
    expect(
      await confirmScheduledWorkFromPortal({ rawToken: raw2, scheduleActionRef: refNewToken }),
    ).toEqual(expect.objectContaining({ ok: false }));

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
    await prisma.portalActionRateLimit.deleteMany({});
  });

  it("Work Station appointment card is HIGH priority and omits message body", async () => {
    await prisma.portalActionRateLimit.deleteMany({});

    const start = new Date(Date.now() + 500_000).toISOString();
    const end = new Date(Date.now() + 600_000).toISOString();
    const { oppId, rawToken } = await seedActivatedJobWithSchedule({ startIso: start, endIso: end });

    const view = await getPortalViewByRawToken(rawToken);
    await confirmScheduledWorkFromPortal({
      rawToken,
      scheduleActionRef: view!.schedule[0]!.scheduleActionRef!,
      optionalNote: "Gate code 1234 — private",
    });

    const ws = await getWorkStationFeed(officeCtxA, parseWorkStationFeedFilters({}));
    const card = ws.cards.find((c) => c.sourceType === "CUSTOMER_PORTAL_SUBMISSION" && c.title.includes("acknowledged"));
    expect(card).toBeTruthy();
    expect(card?.priority).toBe("HIGH");
    expect(card?.category).toBe("NEEDS_REVIEW");
    expect(card?.reason.toLowerCase()).not.toContain("gate code");

    const crewWs = await getWorkStationFeed(crewCtxA, parseWorkStationFeedFilters({}));
    expect(crewWs.cards.some((c) => c.sourceType === "CUSTOMER_PORTAL_SUBMISSION")).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
    await prisma.portalActionRateLimit.deleteMany({});
  });

  it("rate limit: bucket helper is deterministic; exceeds max throws", async () => {
    await prisma.portalActionRateLimit.deleteMany({});
    const fixed = new Date("2026-06-15T12:34:56.789Z");
    const a = computePortalRateLimitWindowStart(fixed);
    const b = computePortalRateLimitWindowStart(fixed);
    expect(a.getTime()).toBe(b.getTime());

    const key = "test-rate-key-" + suffix;
    for (let i = 0; i < PORTAL_POST_RATE_LIMIT_MAX; i += 1) {
      await consumePortalPostRateLimitSlot({ tokenHash: key, action: "PORTAL_SUBMISSION_CREATE", now: fixed });
    }
    await expect(
      consumePortalPostRateLimitSlot({ tokenHash: key, action: "PORTAL_SUBMISSION_CREATE", now: fixed }),
    ).rejects.toThrow(PortalPostRateLimitedError);

    await prisma.portalActionRateLimit.deleteMany({ where: { key } });
  });

  it("portal general note submissions are rate limited", async () => {
    await prisma.portalActionRateLimit.deleteMany({});
    const start = new Date(Date.now() + 880_000).toISOString();
    const end = new Date(Date.now() + 980_000).toISOString();
    const { oppId, rawToken } = await seedActivatedJobWithSchedule({ startIso: start, endIso: end });

    for (let i = 0; i < 10; i += 1) {
      const r = await createPortalSubmissionFromToken({
        rawToken,
        input: { type: CustomerPortalSubmissionType.GENERAL_REQUEST, message: `Message ${i}` },
      });
      expect(r.ok).toBe(true);
    }
    const blocked = await createPortalSubmissionFromToken({
      rawToken,
      input: { type: CustomerPortalSubmissionType.GENERAL_REQUEST, message: "overflow" },
    });
    expect(blocked.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
    await prisma.portalActionRateLimit.deleteMany({});
  });

  it("rate limit key stores tokenHash not raw token", async () => {
    await prisma.portalActionRateLimit.deleteMany({});
    const raw = "raw-token-sample-" + suffix;
    const tokenHash = hashPortalToken(raw);
    await consumePortalPostRateLimitSlot({ tokenHash, action: "PORTAL_APPOINTMENT_CONFIRM", now: new Date() });
    const rows = await prisma.portalActionRateLimit.findMany({ where: { key: tokenHash } });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const r of rows) {
      expect(r.key).not.toContain("raw-token-sample");
    }
    await prisma.portalActionRateLimit.deleteMany({ where: { key: tokenHash } });
  });
});
