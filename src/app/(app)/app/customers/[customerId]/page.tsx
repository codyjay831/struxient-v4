import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgSession } from "@/server/phase1/org-session";
import { getCustomerDetail, listCustomerActivity } from "@/server/phase1/queries";
import { Button } from "@/components/ui/button";
import { formatCustomerKind, formatCustomerStatus, formatOpportunityStatus, formatQuoteStatus } from "@/lib/format-enums";
import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { ContactAddForm, ContactEditForm, CustomerProfileForm } from "./customer-detail-forms";
import {
  CustomerBackLink,
  CustomerPageHeader,
  CustomerSectionCard,
  CustomerWorkspaceShell,
  MetadataPill,
} from "@/components/customers/customer-area";

function formatDetailDate(d: Date) {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const ctx = await requireOrgSession();
  const customer = await getCustomerDetail(ctx.organizationId, customerId);
  if (!customer) {
    notFound();
  }

  const activity = await listCustomerActivity(ctx.organizationId, customer.id);

  const contactsForClient = customer.contactMethods.map((c) => ({
    id: c.id,
    type: c.type,
    value: c.value,
    isPrimary: c.isPrimary,
    okToEmail: c.okToEmail,
    okToSms: c.okToSms,
    label: c.label,
    archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
  }));

  const activeContacts = customer.contactMethods.filter((m) => !m.archivedAt).length;

  return (
    <CustomerWorkspaceShell>
      <nav className="mb-4" aria-label="Breadcrumb">
        <CustomerBackLink />
      </nav>

      <CustomerPageHeader
        title={customer.displayName}
        subtitle="Customer record — contacts and internal notes live here. Opportunities and quotes are managed under Sales and stay linked to this profile."
        badge={
          <>
            <MetadataPill variant="outline">{formatCustomerKind(customer.kind)}</MetadataPill>
            <MetadataPill variant="muted">{formatCustomerStatus(customer.status)}</MetadataPill>
          </>
        }
        actions={
          <Button asChild className="rounded-md font-semibold">
            <Link href={`/app/sales/opportunities/new?customerId=${customer.id}`}>New opportunity</Link>
          </Button>
        }
      />

      <div className="mb-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-border/50 pb-6 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground/80">Created</span> {formatDetailDate(customer.createdAt)}
        </span>
        <span>
          <span className="font-medium text-foreground/80">Updated</span> {formatDetailDate(customer.updatedAt)}
        </span>
        <span>
          <span className="font-medium text-foreground/80">Contacts</span> {activeContacts} active
        </span>
        <span>
          <span className="font-medium text-foreground/80">Opportunities</span> {customer.opportunities.length}
        </span>
      </div>

      <div className="space-y-8">
        <CustomerSectionCard
          title="Profile"
          description="Display identity, lifecycle status, and internal notes. Changes are audited in activity."
        >
          <CustomerProfileForm
            customerId={customer.id}
            displayName={customer.displayName}
            kind={customer.kind}
            status={customer.status}
            notes={customer.notes}
          />
        </CustomerSectionCard>

        <CustomerSectionCard
          title="Contact methods"
          description="Phones, emails, and other reachability — used across quotes, scheduling, and customer-facing flows."
        >
          <ContactAddForm customerId={customer.id} />
          <div className="mt-5 space-y-3">
            {customer.contactMethods.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/70 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                No contacts yet. Add at least one email or phone when you have it — you can always return after
                creating opportunities.
              </p>
            ) : (
              customer.contactMethods.map((c) => (
                <ContactEditForm key={c.id} customerId={customer.id} c={contactsForClient.find((x) => x.id === c.id)!} />
              ))
            )}
          </div>
        </CustomerSectionCard>

        <CustomerSectionCard title="Opportunities" description="Sales pipeline work tied to this customer.">
          {customer.opportunities.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
              No opportunities for this customer yet.{" "}
              <Link
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={`/app/sales/opportunities/new?customerId=${customer.id}`}
              >
                Create an opportunity
              </Link>{" "}
              to capture lead intake and scope.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border/80">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="hidden px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                      Service
                    </th>
                    <th className="hidden px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/80 bg-card/20">
                  {customer.opportunities.map((o) => (
                    <tr key={o.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/app/sales/opportunities/${o.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {o.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatOpportunityStatus(o.status)}</td>
                      <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">{o.serviceType}</td>
                      <td className="hidden px-3 py-2.5 text-xs tabular-nums text-muted-foreground lg:table-cell">
                        {o.updatedAt.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CustomerSectionCard>

        {canAuthorQuotes(ctx.role) && customer.quotes.length > 0 ? (
          <CustomerSectionCard title="Quotes" description="Quotes owned by opportunities for this customer.">
            <div className="overflow-hidden rounded-md border border-border/80">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quote</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opportunity</th>
                    <th className="hidden px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/80 bg-card/20">
                  {customer.quotes.map((q) => (
                    <tr key={q.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/app/sales/quotes/${q.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          #{q.displayNumber}: {q.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatQuoteStatus(q.status)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        <Link
                          href={`/app/sales/opportunities/${q.opportunity.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {q.opportunity.title}
                        </Link>
                      </td>
                      <td className="hidden px-3 py-2.5 text-xs tabular-nums text-muted-foreground lg:table-cell">
                        {q.updatedAt.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CustomerSectionCard>
        ) : null}

        <CustomerSectionCard title="Activity" description="Audited staff actions for this customer record.">
          <div className="overflow-hidden rounded-md border border-border/80 bg-card/15">
            {activity.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted-foreground">No recorded activity yet.</p>
            ) : (
              <ul className="divide-y divide-border/80">
                {activity.map((e) => (
                  <li key={e.id} className="px-4 py-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {e.eventType.replace(/_/g, " ")}
                      </span>
                      <time className="text-[11px] tabular-nums text-muted-foreground">{e.createdAt.toLocaleString()}</time>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{e.summary}</p>
                    {e.opportunity ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Opportunity:{" "}
                        <Link
                          href={`/app/sales/opportunities/${e.opportunity.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {e.opportunity.title}
                        </Link>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CustomerSectionCard>
      </div>
    </CustomerWorkspaceShell>
  );
}
