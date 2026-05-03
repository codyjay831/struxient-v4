/**
 * Phase 11: portal file uploads, attachments, storage, staff listing, Work Station, rate limits.
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
import { getPortalViewByRawToken } from "@/server/phase8/portal-projection";
import { hashPortalToken } from "@/server/phase8/portal-token-crypto";
import { createPortalAccessTokenForQuote, revokeActivePortalTokenForQuote } from "@/server/phase8/portal-token-mutations";
import { listCustomerPortalSubmissionsForQuote } from "@/server/phase9/customer-portal-submission-queries";
import { getWorkStationFeed, parseWorkStationFeedFilters } from "@/server/phase6/work-station-feed";
import { createPortalFileUploadSubmissionFromToken } from "@/server/phase11/portal-file-upload-submission";
import { validatePortalUploadPart } from "@/server/phase11/portal-file-upload-validation";
import { PORTAL_FILE_UPLOAD_RATE_LIMIT_MAX } from "@/server/phase10/portal-post-rate-limit";
import { PORTAL_ACTION_THROTTLED_MESSAGE } from "@/server/phase10/portal-phase10-messages";
import { PORTAL_FILE_UPLOAD_GENERIC_ERROR } from "@/server/phase11/portal-file-upload-messages";
import {
  getPortalObjectStorage,
  resetPortalObjectStorageCacheForTests,
} from "@/server/phase11/portal-object-storage-factory";

config({ path: ".env" });

const JPEG_BYTES = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const PDF_BYTES = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf-8");

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) f.set(k, v);
  return f;
}

describe("Phase 11 portal file upload (integration)", () => {
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
  const suffix = `p11-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let uploadRoot: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    uploadRoot = path.join(tmpdir(), `struxient-p11-${suffix}`);
    mkdirSync(uploadRoot, { recursive: true });
    process.env.PORTAL_UPLOAD_LOCAL_ROOT = uploadRoot;
    resetPortalObjectStorageCacheForTests();

    const passwordHash = await bcrypt.hash("phase11-portal-pass-12", 8);

    const orgA = await prisma.organization.create({
      data: { name: `Org P11A ${suffix}`, slug: `org-p11a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org P11B ${suffix}`, slug: `org-p11b-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-p11a-${suffix}@test.local`, passwordHash, name: "Sales P11A" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-p11a-${suffix}@test.local`, passwordHash, name: "Office P11A" },
    });
    const userCrewLeadA = await prisma.user.create({
      data: { email: `crewlead-p11a-${suffix}@test.local`, passwordHash, name: "Crew P11A" },
    });
    const userSalesB = await prisma.user.create({
      data: { email: `sales-p11b-${suffix}@test.local`, passwordHash, name: "Sales P11B" },
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
      data: { organizationId: orgAId, displayName: `Customer P11 ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-p11-${suffix}@example.com`,
        isPrimary: true,
      },
    });

    await prisma.customer.create({
      data: { organizationId: orgBId, displayName: `Customer P11B ${suffix}` },
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

  async function seedSentQuote() {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp P11 ${suffix}`,
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
        title: "Internal task title",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 0,
        customerVisible: true,
        customerLabel: "Permitting",
      },
    });

    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));

    return { oppId: opp.id, quoteId };
  }

  it("creates FILE_UPLOAD submission with attachment, checksum, STORED status, scope from token; no quote/job mutation", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rawToken = created.portalPath!.slice("/portal/".length);

    const sentSnapshotBefore = (
      await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { sentSnapshotJson: true } })
    ).sentSnapshotJson;
    const jobCountBefore = await prisma.job.count({ where: { organizationId: orgAId } });

    const part = validatePortalUploadPart({
      originalFilename: "site-panel.jpg",
      declaredContentType: "image/jpeg",
      buffer: JPEG_BYTES,
    });

    const r = await createPortalFileUploadSubmissionFromToken({
      rawToken,
      optionalNote: "North side of house",
      parts: [part],
    });
    expect(r.ok).toBe(true);

    const sub = await prisma.customerPortalSubmission.findFirstOrThrow({
      where: { quoteId, type: CustomerPortalSubmissionType.FILE_UPLOAD },
      include: { attachments: true },
    });
    expect(sub.organizationId).toBe(orgAId);
    expect(sub.customerId).toBe(customerAId);
    expect(sub.quoteId).toBe(quoteId);
    expect(sub.status).toBe(CustomerPortalSubmissionStatus.NEW);
    expect(sub.message).toContain("North side");
    expect(sub.attachments).toHaveLength(1);
    const att = sub.attachments[0]!;
    expect(att.status).toBe(CustomerPortalSubmissionAttachmentStatus.STORED);
    expect(att.checksumSha256).toBe(part.checksumSha256);
    expect(att.storageKey.startsWith(`${orgAId}/portal/`)).toBe(true);

    const storage = getPortalObjectStorage();
    const stream = await storage.getObjectStream(att.storageKey);
    const chunks: Buffer[] = [];
    for await (const ch of stream) {
      chunks.push(typeof ch === "string" ? Buffer.from(ch) : ch);
    }
    const roundTrip = Buffer.concat(chunks);
    expect(roundTrip.equals(JPEG_BYTES)).toBe(true);

    const quoteAfter = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(quoteAfter.sentSnapshotJson).toEqual(sentSnapshotBefore);
    expect(await prisma.job.count({ where: { organizationId: orgAId } })).toBe(jobCountBefore);

    const view = await getPortalViewByRawToken(rawToken);
    expect(view).not.toBeNull();
    const ser = JSON.stringify(view).toLowerCase();
    expect(ser).not.toContain("storagekey");
    expect(ser).not.toContain("customersportalsubmissionattachment");

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("accepts PNG and PDF; invalid token fails; revoked token fails", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rawToken = created.portalPath!.slice("/portal/".length);

    const pngPart = validatePortalUploadPart({
      originalFilename: "plan.png",
      declaredContentType: "image/png",
      buffer: PNG_BYTES,
    });
    const pdfPart = validatePortalUploadPart({
      originalFilename: "permit.pdf",
      declaredContentType: "application/pdf",
      buffer: PDF_BYTES,
    });

    const okPng = await createPortalFileUploadSubmissionFromToken({ rawToken, parts: [pngPart] });
    expect(okPng.ok).toBe(true);
    const okPdf = await createPortalFileUploadSubmissionFromToken({ rawToken, parts: [pdfPart] });
    expect(okPdf.ok).toBe(true);

    const bad = await createPortalFileUploadSubmissionFromToken({
      rawToken: `${rawToken}x`,
      parts: [pngPart],
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe(PORTAL_FILE_UPLOAD_GENERIC_ERROR);

    await revokeActivePortalTokenForQuote(officeCtxA, quoteId);
    const revoked = await createPortalFileUploadSubmissionFromToken({ rawToken, parts: [pngPart] });
    expect(revoked.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("enforces PORTAL_FILE_UPLOAD rate limit per token hash", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rawToken = created.portalPath!.slice("/portal/".length);
    const part = validatePortalUploadPart({
      originalFilename: "a.jpg",
      declaredContentType: "image/jpeg",
      buffer: JPEG_BYTES,
    });

    for (let i = 0; i < PORTAL_FILE_UPLOAD_RATE_LIMIT_MAX; i++) {
      const r = await createPortalFileUploadSubmissionFromToken({
        rawToken,
        optionalNote: `batch ${i}`,
        parts: [part],
      });
      expect(r.ok).toBe(true);
    }

    const throttled = await createPortalFileUploadSubmissionFromToken({ rawToken, parts: [part] });
    expect(throttled.ok).toBe(false);
    expect(throttled.error).toBe(PORTAL_ACTION_THROTTLED_MESSAGE);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("staff listing includes attachments; cross-org listing empty; Work Station card for SALES, not CREW_LEAD", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rawToken = created.portalPath!.slice("/portal/".length);
    const part = validatePortalUploadPart({
      originalFilename: "evidence.jpg",
      declaredContentType: "image/jpeg",
      buffer: JPEG_BYTES,
    });
    await createPortalFileUploadSubmissionFromToken({ rawToken, parts: [part] });

    const rowsA = await listCustomerPortalSubmissionsForQuote(salesCtxA, quoteId);
    const uploadRow = rowsA.find((r) => r.type === CustomerPortalSubmissionType.FILE_UPLOAD);
    expect(uploadRow).toBeTruthy();
    expect(uploadRow!.attachments.length).toBe(1);
    expect(uploadRow!.attachments[0]!.originalFilename).toBe("evidence.jpg");

    const rowsB = await listCustomerPortalSubmissionsForQuote(salesCtxB, quoteId);
    expect(rowsB).toHaveLength(0);

    const feedSales = await getWorkStationFeed(salesCtxA, parseWorkStationFeedFilters({}));
    const portalCards = feedSales.cards.filter((c) => c.sourceType === "CUSTOMER_PORTAL_SUBMISSION");
    const uploadCard = portalCards.find((c) => c.title === "Customer uploaded files for review");
    expect(uploadCard).toBeTruthy();
    expect(uploadCard!.reason.toLowerCase()).not.toContain(".jpg");
    expect(uploadCard!.reason.toLowerCase()).not.toContain("evidence");

    const feedCrew = await getWorkStationFeed(crewLeadCtxA, parseWorkStationFeedFilters({}));
    const crewPortal = feedCrew.cards.filter((c) => c.sourceType === "CUSTOMER_PORTAL_SUBMISSION");
    expect(crewPortal).toHaveLength(0);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("storage key is not exposed via portal view; raw token hash used for rate limit rows only", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rawToken = created.portalPath!.slice("/portal/".length);
    const tokenHash = hashPortalToken(rawToken);

    const part = validatePortalUploadPart({
      originalFilename: "z.jpg",
      declaredContentType: "image/jpeg",
      buffer: JPEG_BYTES,
    });
    await createPortalFileUploadSubmissionFromToken({ rawToken, parts: [part] });

    const rl = await prisma.portalActionRateLimit.findMany({
      where: { key: tokenHash, action: "PORTAL_FILE_UPLOAD" },
    });
    expect(rl.length).toBeGreaterThanOrEqual(1);

    const view = await getPortalViewByRawToken(rawToken);
    expect(JSON.stringify(view).toLowerCase()).not.toContain("tokenhash");

    await prisma.portalActionRateLimit.deleteMany({ where: { key: tokenHash } });
    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });
});
