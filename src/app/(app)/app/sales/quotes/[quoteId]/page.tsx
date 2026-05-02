import Link from "next/link";
import { notFound } from "next/navigation";
import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { canManageQuoteWorkTemplates } from "@/lib/phase3-permissions";
import { requireOrgSession } from "@/server/phase1/org-session";
import { listOrganizationMembers } from "@/server/phase1/queries";
import { getQuotePreviewForWorkspace } from "@/server/phase2/customer-preview";
import { allQuoteSendBlockersPass, evaluateQuoteSendReadiness } from "@/server/phase2/quote-readiness";
import { getQuoteIdInOrganization, getQuoteWorkspace, listQuoteActivity } from "@/server/phase2/quote-queries";
import { listActiveQuoteWorkTemplatesGrouped } from "@/server/phase3/template-queries";
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

  const payload = {
    organizationName: ctx.organizationName,
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
  };

  return <QuoteWorkspace {...payload} />;
}
