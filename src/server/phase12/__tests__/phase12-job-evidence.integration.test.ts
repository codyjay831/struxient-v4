/**
 * Phase 12: JobEvidence promotion, review, RBAC, Work Station, no task mutation.
 * Requires DATABASE_URL and PostgreSQL.
 */
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  CustomerContactType,
  CustomerPortalSubmissionAttachmentStatus,
  CustomerPortalSubmissionStatus,
  CustomerPortalSubmissionType,
  JobEvidenceStatus,
  MembershipRole,
  OpportunityPriority,
  OpportunityStatus,
  OpportunityTaskKind,
  OpportunityTaskStatus,
  PricingMode,
  QuoteLineMode,
  QuoteTaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import {
  quoteMutationAddLineItem,
  quoteMutationCreateDraftFromOpportunity,
  quoteMutationMarkReadyToSend,
  quoteMutationMarkSent,
} from "@/server/phase2/quote-mutations";
import { quoteMutationMarkAccepted, quoteMutationActivateAcceptedQuoteAsJob } from "@/server/phase4/quote-accept-activate";
import { getPortalViewByRawToken } from "@/server/phase8/portal-projection";
import { createPortalAccessTokenForQuote } from "@/server/phase8/portal-token-mutations";
import { getWorkStationFeed, parseWorkStationFeedFilters } from "@/server/phase6/work-station-feed";
import { createPortalFileUploadSubmissionFromToken } from "@/server/phase11/portal-file-upload-submission";
import { validatePortalUploadPart } from "@/server/phase11/portal-file-upload-validation";
import { resetPortalObjectStorageCacheForTests } from "@/server/phase11/portal-object-storage-factory";
import {
  acceptJobEvidence,
  promoteCustomerUploadAttachmentToJobEvidence,
  rejectJobEvidence,
} from "@/server/phase12/job-evidence-mutations";
import { listCandidateJobEvidenceForWorkStation, listJobEvidenceForJob } from "@/server/phase12/job-evidence-queries";

config({ path: ".env" });

const JPEG_BYTES = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) f.set(k, v);
  return f;
}

describe("Phase 12 job evidence (integration)", () => {
  let orgAId: string;
  let orgBId: string;
  let userSalesAId: string;
  let userOfficeAId: string;
  let userCrewLeadAId: string;
  let userSalesBId: string;
  let customerAId: string;
  let salesCtxA: OrgSessionContext;
  let officeCtxA: OrgSessionContext;
  let crewLeadCtxA: OrgSessionContext;
  let salesCtxB: OrgSessionContext;
  const suffix = `p12-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let uploadRoot: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    uploadRoot = path.join(tmpdir(), `struxient-p12-${suffix}`);
    mkdirSync(uploadRoot, { recursive: true });
    process.env.PORTAL_UPLOAD_LOCAL_ROOT = uploadRoot;
    resetPortalObjectStorageCacheForTests();

    const passwordHash = await bcrypt.hash("phase12-evidence-pass-12", 8);

    const orgA = await prisma.organization.create({
      data: { name: `Org P12A ${suffix}`, slug: `org-p12a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org P12B ${suffix}`, slug: `org-p12b-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-p12a-${suffix}@test.local`, passwordHash, name: "Sales P12A" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-p12a-${suffix}@test.local`, passwordHash, name: "Office P12A" },
    });
    const userCrewLeadA = await prisma.user.create({
      data: { email: `crewlead-p12a-${suffix}@test.local`, passwordHash, name: "Crew P12A" },
    });
    const userSalesB = await prisma.user.create({
      data: { email: `sales-p12b-${suffix}@test.local`, passwordHash, name: "Sales P12B" },
    });
    userSalesAId = userSalesA.id;
    userOfficeAId = userOfficeA.id;
    userCrewLeadAId = userCrewLeadA.id;
    userSalesBId = userSalesB.id;

    await prisma.membership.create({
      data: { userId: userSalesAId, organizationId: orgAId, role: MembershipRole.SALES },
    });
    await prisma.membership.create({
      data: { userId: userOfficeAId, organizationId: orgAId, role: MembershipRole.OFFICE },
    });
    await prisma.membership.create({
      data: { userId: userCrewLeadAId, organizationId: orgAId, role: MembershipRole.CREW_LEAD },
    });
    await prisma.membership.create({
      data: { userId: userSalesBId, organizationId: orgBId, role: MembershipRole.SALES },
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
    crewLeadCtxA = {
      userId: userCrewLeadAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.CREW_LEAD,
      email: userCrewLeadA.email!,
      name: userCrewLeadA.name,
    };
    salesCtxB = {
      userId: userSalesBId,
      organizationId: orgBId,
      organizationName: orgB.name,
      role: MembershipRole.SALES,
      email: userSalesB.email!,
      name: userSalesB.name,
    };

    const customerA = await prisma.customer.create({
      data: { organizationId: orgAId, displayName: `Customer P12 ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-p12-${suffix}@example.com`,
        isPrimary: true,
      },
    });

    await prisma.customer.create({
      data: { organizationId: orgBId, displayName: `Customer P12B ${suffix}` },
    });
  });

  afterAll(async () => {
    resetPortalObjectStorageCacheForTests();
    delete process.env.PORTAL_UPLOAD_LOCAL_ROOT;
    try {
      rmSync(uploadRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [userSalesAId, userOfficeAId, userCrewLeadAId, userSalesBId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function seedJobWithFileUpload(): Promise<{
    oppId: string;
    quoteId: string;
    jobId: string;
    jobTaskId: string;
    attachmentId: string;
    submissionId: string;
    rawToken: string;
  }> {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp P12 ${suffix}`,
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

    await prisma.quote.update({
      where: { id: quoteId },
      data: { customerFacingIntro: "Intro" },
    });

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
        title: "Exec task for evidence",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 0,
        customerVisible: true,
        customerLabel: "Permitting",
      },
    });

    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));

    const acc = await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    expect(acc.ok).toBe(true);
    const act = await quoteMutationActivateAcceptedQuoteAsJob(officeCtxA, fd({ quoteId }));
    expect(act.ok).toBe(true);
    if (!act.ok) throw new Error("activate");
    const jobId = act.jobId;

    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("token");
    const rawToken = created.portalPath!.slice("/portal/".length);

    const part = validatePortalUploadPart({
      originalFilename: "site-photo.jpg",
      declaredContentType: "image/jpeg",
      buffer: JPEG_BYTES,
    });
    const up = await createPortalFileUploadSubmissionFromToken({ rawToken, parts: [part] });
    expect(up.ok).toBe(true);

    const sub = await prisma.customerPortalSubmission.findFirstOrThrow({
      where: { quoteId, type: CustomerPortalSubmissionType.FILE_UPLOAD },
      include: { attachments: true },
    });
    const attachmentId = sub.attachments[0]!.id;
    const submissionId = sub.id;

    const jobTask = await prisma.jobTask.findFirstOrThrow({ where: { jobId } });

    return { oppId: opp.id, quoteId, jobId, jobTaskId: jobTask.id, attachmentId, submissionId, rawToken };
  }

  it("promotes to CANDIDATE, accept/reject, duplicate blocked, no intake or task mutation; Work Station for office only", async () => {
    const { oppId, jobId, jobTaskId, attachmentId, submissionId } = await seedJobWithFileUpload();

    const taskBefore = await prisma.jobTask.findUniqueOrThrow({ where: { id: jobTaskId } });

    const denySales = await promoteCustomerUploadAttachmentToJobEvidence(salesCtxA, {
      sourceAttachmentId: attachmentId,
      jobId,
      jobTaskId: null,
      title: "Permit photo",
    });
    expect(denySales.ok).toBe(false);

    const p1 = await promoteCustomerUploadAttachmentToJobEvidence(officeCtxA, {
      sourceAttachmentId: attachmentId,
      jobId,
      jobTaskId: null,
      title: "Permit photo",
    });
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;

    const ev = await prisma.jobEvidence.findUniqueOrThrow({ where: { id: p1.evidenceId } });
    expect(ev.status).toBe(JobEvidenceStatus.CANDIDATE);
    expect(ev.sourceAttachmentId).toBe(attachmentId);

    const subAfter = await prisma.customerPortalSubmission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(subAfter.status).toBe(CustomerPortalSubmissionStatus.NEW);
    const attAfter = await prisma.customerPortalSubmissionAttachment.findUniqueOrThrow({ where: { id: attachmentId } });
    expect(attAfter.status).toBe(CustomerPortalSubmissionAttachmentStatus.STORED);

    const dup = await promoteCustomerUploadAttachmentToJobEvidence(officeCtxA, {
      sourceAttachmentId: attachmentId,
      jobId,
      jobTaskId: null,
      title: "Dup",
    });
    expect(dup.ok).toBe(false);

    const cross = await promoteCustomerUploadAttachmentToJobEvidence(salesCtxB, {
      sourceAttachmentId: attachmentId,
      jobId,
      jobTaskId: null,
      title: "X",
    });
    expect(cross.ok).toBe(false);

    const wsOffice = await getWorkStationFeed(officeCtxA, parseWorkStationFeedFilters({}));
    const evCards = wsOffice.cards.filter((c) => c.sourceType === "JOB_EVIDENCE");
    expect(evCards.length).toBeGreaterThanOrEqual(1);
    const mine = evCards.find((c) => c.sourceId === p1.evidenceId);
    expect(mine?.title).toBe("Evidence candidate needs review");
    expect(mine?.reason.toLowerCase()).not.toContain(".jpg");
    expect(mine?.primaryHref).toContain(`/app/jobs/${jobId}`);

    const wsCrew = await getWorkStationFeed(crewLeadCtxA, parseWorkStationFeedFilters({}));
    expect(wsCrew.cards.some((c) => c.sourceType === "JOB_EVIDENCE")).toBe(false);

    const wsSales = await getWorkStationFeed(salesCtxA, parseWorkStationFeedFilters({}));
    expect(wsSales.cards.some((c) => c.sourceType === "JOB_EVIDENCE")).toBe(false);

    const denyAcceptSales = await acceptJobEvidence(salesCtxA, p1.evidenceId);
    expect(denyAcceptSales.ok).toBe(false);

    const accOk = await acceptJobEvidence(officeCtxA, p1.evidenceId);
    expect(accOk.ok).toBe(true);

    const evAcc = await prisma.jobEvidence.findUniqueOrThrow({ where: { id: p1.evidenceId } });
    expect(evAcc.status).toBe(JobEvidenceStatus.ACCEPTED);

    const taskAfterAccept = await prisma.jobTask.findUniqueOrThrow({ where: { id: jobTaskId } });
    expect(taskAfterAccept.status).toBe(taskBefore.status);
    expect(taskAfterAccept.completedAt).toEqual(taskBefore.completedAt);

    const { oppId: opp2, jobId: j2, jobTaskId: t2, attachmentId: a2 } = await seedJobWithFileUpload();
    const p2 = await promoteCustomerUploadAttachmentToJobEvidence(officeCtxA, {
      sourceAttachmentId: a2,
      jobId: j2,
      jobTaskId: t2,
      title: "Task scoped",
    });
    expect(p2.ok).toBe(true);
    if (!p2.ok) return;

    const denyReject = await rejectJobEvidence(officeCtxA, p2.evidenceId, "   ");
    expect(denyReject.ok).toBe(false);

    const rej = await rejectJobEvidence(officeCtxA, p2.evidenceId, "Wrong document type for this task.");
    expect(rej.ok).toBe(true);
    const evRej = await prisma.jobEvidence.findUniqueOrThrow({ where: { id: p2.evidenceId } });
    expect(evRej.status).toBe(JobEvidenceStatus.REJECTED);
    expect(evRej.rejectionReason).toContain("Wrong document");

    const denyRejAgain = await rejectJobEvidence(officeCtxA, p2.evidenceId, "Again");
    expect(denyRejAgain.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: { in: [oppId, opp2] } } });
    await prisma.opportunity.deleteMany({ where: { id: { in: [oppId, opp2] } } });
  });

  it("portal projection does not expose job evidence identifiers", async () => {
    const { oppId, rawToken } = await seedJobWithFileUpload();
    const view = await getPortalViewByRawToken(rawToken);
    expect(view).not.toBeNull();
    const ser = JSON.stringify(view).toLowerCase();
    expect(ser).not.toContain("jobevidence");
    expect(ser).not.toContain("sourceattachmentid");
    expect(ser).not.toContain("storagekey");

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("list queries are org-scoped; sales can list read-only", async () => {
    const { oppId, jobId, attachmentId } = await seedJobWithFileUpload();
    const p = await promoteCustomerUploadAttachmentToJobEvidence(officeCtxA, {
      sourceAttachmentId: attachmentId,
      jobId,
      jobTaskId: null,
      title: "List test",
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;

    const rowsSales = await listJobEvidenceForJob(salesCtxA, jobId);
    expect(rowsSales.some((r) => r.id === p.evidenceId)).toBe(true);

    const wsRows = await listCandidateJobEvidenceForWorkStation(officeCtxA);
    expect(wsRows.some((r) => r.id === p.evidenceId)).toBe(true);

    const denyList = listJobEvidenceForJob(salesCtxB, jobId);
    await expect(denyList).rejects.toThrow();

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });
});
