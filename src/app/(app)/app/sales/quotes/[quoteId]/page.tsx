import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerPortalSubmissionType, QuoteLineMode, QuoteStatus } from "@prisma/client";
import { canCreateCustomerPortalLink, canRevokeOrRegenerateCustomerPortalLink } from "@/lib/phase8-permissions";
import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { canManageQuoteWorkTemplates } from "@/lib/phase3-permissions";
import { requireOrgSession } from "@/server/phase1/org-session";
import { listOrganizationMembers } from "@/server/phase1/queries";
import { getQuotePreviewForWorkspace, parseSentSnapshotPreviewDto } from "@/server/phase2/customer-preview";
import {
  parseJobTaskCompletionRequirements,
  toCompletionRequirementDto,
} from "@/server/phase13/completion-requirements";
import { allQuoteSendBlockersPass, evaluateQuoteSendReadiness } from "@/server/phase2/quote-readiness";
import { getQuoteEmailSendFormAvailability } from "@/server/email/quote-email-send-availability";
import {
  getQuoteIdInOrganization,
  getQuoteLastProposalEmailRecipient,
  getQuoteLatestOpenEmailDeliveryFailure,
  getQuoteWorkspace,
  listQuoteActivity,
} from "@/server/phase2/quote-queries";
import { listActiveQuoteWorkTemplatesGrouped } from "@/server/phase3/template-queries";
import { findActivePortalTokenForQuote } from "@/server/phase8/portal-token-queries";
import { canManageCustomerPortalSubmissions, canViewCustomerPortalSubmissions } from "@/lib/phase9-permissions";
import {
  countNewCustomerPortalSubmissionsForQuote,
  listCustomerPortalSubmissionsForQuote,
} from "@/server/phase9/customer-portal-submission-queries";
import { formatScheduleWindowDisplay } from "@/lib/format-schedule-window";
import { isQuoteStructurallyLocked } from "@/lib/quote-lifecycle";
import { canManageJobEvidence, canViewJobEvidence } from "@/lib/phase12-permissions";
import {
  listJobTasksForEvidencePicker,
  listPromotionBucketsForAttachmentsOnJob,
} from "@/server/phase12/job-evidence-queries";
import { QuoteWorkspace } from "./quote-workspace";

export default async function QuoteWorkspacePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const ctx = await requireOrgSession();

  const inOrg = await getQuoteIdInOrganization(ctx.organizationId, quoteId);
  if (!inOrg) {
    notFound();
  }

  if (!canAuthorQuotes(ctx.role)) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-8">
        <h1 className="text-lg font-semibold text-foreground">Access restricted</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Quote authoring is limited to sales and office roles. If you need access, ask an administrator to update your
          membership role.
        </p>
        <Link href="/app/work-station" className="text-sm font-medium text-primary hover:underline">
          Back to Work Station
        </Link>
      </div>
    );
  }

  const quote = await getQuoteWorkspace(ctx.organizationId, quoteId);
  if (!quote) {
    notFound();
  }

  const activity = await listQuoteActivity(ctx.organizationId, quote.id);
  const emailSendAvail = getQuoteEmailSendFormAvailability();
  const emailDeliveryFailure = isQuoteStructurallyLocked(quote.status)
    ? await getQuoteLatestOpenEmailDeliveryFailure(ctx.organizationId, quote.id)
    : null;
  const lastProposalEmailRecipient = isQuoteStructurallyLocked(quote.status)
    ? await getQuoteLastProposalEmailRecipient(ctx.organizationId, quote.id)
    : null;
  const membersRaw = await listOrganizationMembers(ctx.organizationId);
  const members = membersRaw.map((m) => ({
    id: m.user.id,
    label: m.user.name?.trim() ? `${m.user.name} (${m.user.email})` : m.user.email,
  }));

  const readiness = evaluateQuoteSendReadiness({
    quote,
    opportunity: quote.opportunity,
    customerContacts: quote.customer.contactMethods,
    lineItems: quote.lineItems,
    quoteTasks: quote.tasks,
    assumptions: quote.assumptions,
  });
  const sendBlocked = !allQuoteSendBlockersPass(readiness);
  const warningCount = readiness.filter((i) => i.severity === "WARNING").length;

  const defaultExpandedSection: "basics" | "proposal" | "lines" | "execution" | "readiness" | "activity" = (() => {
    if (isQuoteStructurallyLocked(quote.status)) return "lines";
    if (!quote.title.trim() || !quote.scopeIntent.trim()) return "basics";
    const activeLines = quote.lineItems.filter((l) => l.lineMode !== QuoteLineMode.REMOVED);
    if (activeLines.length === 0) return "lines";
    if (sendBlocked) return "readiness";
    return "lines";
  })();

  const workTemplatesRaw = await listActiveQuoteWorkTemplatesGrouped(ctx.organizationId);
  const workTemplates = {
    line: workTemplatesRaw.line.map((t) => ({
      id: t.id,
      kind: t.kind,
      name: t.name,
      description: t.description,
      tags: t.tags,
      contentVersion: t.contentVersion,
      updatedAt: t.updatedAt.toISOString(),
    })),
    stage: workTemplatesRaw.stage.map((t) => ({
      id: t.id,
      kind: t.kind,
      name: t.name,
      description: t.description,
      tags: t.tags,
      contentVersion: t.contentVersion,
      updatedAt: t.updatedAt.toISOString(),
    })),
    task: workTemplatesRaw.task.map((t) => ({
      id: t.id,
      kind: t.kind,
      name: t.name,
      description: t.description,
      tags: t.tags,
      contentVersion: t.contentVersion,
      updatedAt: t.updatedAt.toISOString(),
    })),
  };

  const previewResolution = getQuotePreviewForWorkspace({
    quoteStatus: quote.status,
    sentSnapshotJson: quote.sentSnapshotJson,
    liveParams: {
      organizationName: ctx.organizationName,
      quote,
      customer: quote.customer,
      lineItems: quote.lineItems,
      assumptions: quote.assumptions,
    },
  });

  const portalPostSend: QuoteStatus[] = [QuoteStatus.SENT, QuoteStatus.ACCEPTED, QuoteStatus.ACTIVATED];
  const portalSnapshotOk = parseSentSnapshotPreviewDto(quote.sentSnapshotJson) !== null;
  const showCustomerPortalSection = portalPostSend.includes(quote.status) && portalSnapshotOk;
  const activePortalToken = showCustomerPortalSection
    ? await findActivePortalTokenForQuote(ctx.organizationId, quote.id)
    : null;

  const portalSubmissionsAccess = canViewCustomerPortalSubmissions(ctx.role);
  const portalSubmissionsRaw = portalSubmissionsAccess
    ? await listCustomerPortalSubmissionsForQuote(ctx, quote.id)
    : [];
  const portalNewCount = portalSubmissionsAccess
    ? await countNewCustomerPortalSubmissionsForQuote(ctx, quote.id)
    : 0;

  const evidenceView = canViewJobEvidence(ctx.role);
  const evidenceManage = canManageJobEvidence(ctx.role);

  const jobToAttachmentIds = new Map<string, string[]>();
  if (portalSubmissionsAccess && evidenceView) {
    for (const s of portalSubmissionsRaw) {
      if (s.type !== CustomerPortalSubmissionType.FILE_UPLOAD || !s.job?.id) continue;
      const jid = s.job.id;
      const cur = jobToAttachmentIds.get(jid) ?? [];
      for (const a of s.attachments) {
        cur.push(a.id);
      }
      jobToAttachmentIds.set(jid, cur);
    }
  }
  const bucketsFlat: { attachmentId: string; jobId: string; jobTaskId: string | null }[] = [];
  const taskOptionsByJobId: Record<string, { id: string; title: string }[]> = {};
  if (portalSubmissionsAccess && evidenceView) {
    for (const [jid, ids] of jobToAttachmentIds) {
      const uniq = [...new Set(ids)];
      if (uniq.length === 0) continue;
      const part = await listPromotionBucketsForAttachmentsOnJob(ctx, jid, uniq);
      for (const b of part) {
        bucketsFlat.push({ attachmentId: b.attachmentId, jobId: jid, jobTaskId: b.jobTaskId });
      }
      taskOptionsByJobId[jid] = await listJobTasksForEvidencePicker(ctx, jid);
    }
  }

  const evidencePromotionPayload =
    portalSubmissionsAccess && evidenceView
      ? { taskOptionsByJobId, buckets: bucketsFlat, quoteIdForRevalidate: quote.id }
      : undefined;

  const payload = {
    quote: {
      id: quote.id,
      displayNumber: quote.displayNumber,
      status: quote.status,
      title: quote.title,
      serviceAddressText: quote.serviceAddressText,
      serviceAddressTbd: quote.serviceAddressTbd,
      scopeIntent: quote.scopeIntent,
      scopeSummary: quote.scopeSummary,
      customerFacingIntro: quote.customerFacingIntro,
      internalNotes: quote.internalNotes,
      pricingSubtotalCents: quote.pricingSubtotalCents,
      totalCents: quote.totalCents,
      sentAt: quote.sentAt?.toISOString() ?? null,
      acceptedAt: quote.acceptedAt?.toISOString() ?? null,
      activatedAt: quote.activatedAt?.toISOString() ?? null,
      job: quote.job
        ? { id: quote.job.id, displayNumber: quote.job.displayNumber, status: quote.job.status }
        : null,
      customerId: quote.customerId,
      opportunityId: quote.opportunityId,
      ownerUserId: quote.ownerUserId,
      customer: {
        id: quote.customer.id,
        displayName: quote.customer.displayName,
        contacts: quote.customer.contactMethods.map((c) => ({
          id: c.id,
          type: c.type,
          value: c.value,
          isPrimary: c.isPrimary,
          label: c.label,
        })),
      },
      opportunity: {
        id: quote.opportunity.id,
        title: quote.opportunity.title,
        serviceType: quote.opportunity.serviceType,
      },
      lineItems: quote.lineItems.map((l) => ({
        id: l.id,
        title: l.title,
        customerDescription: l.customerDescription,
        quantity: String(l.quantity),
        unitPriceCents: l.unitPriceCents,
        lineTotalCents: l.lineTotalCents,
        pricingMode: l.pricingMode,
        lineMode: l.lineMode,
        sortOrder: l.sortOrder,
        internalNotes: l.internalNotes,
        sourceTemplateId: l.sourceTemplateId,
        sourceTemplateKind: l.sourceTemplateKind,
        sourceTemplateVersion: l.sourceTemplateVersion,
        sourceTemplateName: l.sourceTemplateName,
        executionStages: l.executionStages.map((s) => ({
          id: s.id,
          title: s.title,
          sortOrder: s.sortOrder,
          internalNotes: s.internalNotes,
          tasks: s.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            isRequired: t.isRequired,
            sortOrder: t.sortOrder,
            assignedRole: t.assignedRole,
            estimatedDurationMinutes: t.estimatedDurationMinutes,
            customerVisible: t.customerVisible,
            customerLabel: t.customerLabel,
            internalNotes: t.internalNotes,
            completionRequirement: toCompletionRequirementDto(parseJobTaskCompletionRequirements(t.completionRequirementsJson)),
          })),
        })),
      })),
      tasks: quote.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        isRequired: t.isRequired,
        sortOrder: t.sortOrder,
        assignedRole: t.assignedRole,
        estimatedDurationMinutes: t.estimatedDurationMinutes,
        customerVisible: t.customerVisible,
        customerLabel: t.customerLabel,
        internalNotes: t.internalNotes,
      })),
      assumptions: quote.assumptions.map((a) => ({
        id: a.id,
        visibility: a.visibility,
        text: a.text,
        sortOrder: a.sortOrder,
        quoteLineItemId: a.quoteLineItemId,
      })),
    },
    readiness,
    sendBlocked,
    warningCount,
    activity: activity.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      summary: e.summary,
      createdAt: e.createdAt.toISOString(),
    })),
    members,
    previewResolution,
    workTemplates,
    canManageWorkTemplates: canManageQuoteWorkTemplates(ctx.role),
    emailSend: {
      canAttemptSend: emailSendAvail.canAttemptSend,
      blockedReason: emailSendAvail.canAttemptSend ? null : emailSendAvail.reason,
    },
    emailDeliveryFailure,
    lastProposalEmailRecipient,
    customerPortal: {
      showSection: showCustomerPortalSection,
      hasActiveToken: Boolean(activePortalToken),
      lastViewedAt: activePortalToken?.lastViewedAt?.toISOString() ?? null,
      canCreateLink: canCreateCustomerPortalLink(ctx.role),
      canRevokeRegenerateLink: canRevokeOrRegenerateCustomerPortalLink(ctx.role),
    },
    customerPortalSubmissions: portalSubmissionsAccess
      ? {
          canView: true,
          canManage: canManageCustomerPortalSubmissions(ctx.role),
          canManageJobEvidence: evidenceManage,
          evidencePromotion: evidencePromotionPayload,
          newCount: portalNewCount,
          items: portalSubmissionsRaw.map((s) => ({
            id: s.id,
            type: s.type,
            status: s.status,
            subject: s.subject,
            message: s.message,
            createdAt: s.createdAt.toISOString(),
            customerDisplayName: s.customer.displayName.trim(),
            quoteDisplayNumber: s.quote?.displayNumber ?? null,
            jobDisplayNumber: s.job?.displayNumber ?? null,
            jobId: s.job?.id ?? null,
            visitLabel:
              s.type === CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION && s.scheduledWork?.jobTask
                ? s.scheduledWork.jobTask.customerLabel?.trim() ||
                  s.scheduledWork.jobTask.title?.trim() ||
                  null
                : null,
            scheduleWindowDisplay:
              s.type === CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION && s.scheduledWork
                ? formatScheduleWindowDisplay(
                    s.scheduledWork.scheduledStartAt.toISOString(),
                    s.scheduledWork.scheduledEndAt.toISOString(),
                  )
                : null,
            attachments: s.attachments.map((a) => ({
              id: a.id,
              originalFilename: a.originalFilename,
              sanitizedFilename: a.sanitizedFilename,
              contentType: a.contentType,
              detectedContentType: a.detectedContentType,
              sizeBytes: a.sizeBytes,
              status: a.status,
              createdAt: a.createdAt.toISOString(),
            })),
          })),
        }
      : undefined,
  };

  return <QuoteWorkspace {...payload} defaultExpandedSection={defaultExpandedSection} />;
}
