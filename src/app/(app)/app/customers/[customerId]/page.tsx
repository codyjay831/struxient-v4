import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgSession } from "@/server/phase1/org-session";
import { getCustomerDetail, listCustomerActivity } from "@/server/phase1/queries";
import { Button } from "@/components/ui/button";
import { formatCustomerStatus, formatOpportunityStatus, formatQuoteStatus } from "@/lib/format-enums";
import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { ContactAddForm, ContactEditForm, CustomerProfileForm } from "./customer-detail-forms";

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

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Link href="/app/customers" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            ← Customers
          </Link>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{customer.displayName}</h1>
            <span className="rounded-sm border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
              {formatCustomerStatus(customer.status)}
            </span>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Customer record and contacts. Opportunities are opened under Sales and stay linked here.
          </p>
        </div>
        <Button asChild className="w-fit rounded-sm">
          <Link href={`/app/sales/opportunities/new?customerId=${customer.id}`}>New opportunity</Link>
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Profile</h2>
        <CustomerProfileForm
          customerId={customer.id}
          displayName={customer.displayName}
          kind={customer.kind}
          status={customer.status}
          notes={customer.notes}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-foreground">Contact methods</h2>
        </div>
        <ContactAddForm customerId={customer.id} />
        <div className="space-y-3">
          {customer.contactMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts yet. Add at least one email or phone when possible.</p>
          ) : (
            customer.contactMethods.map((c) => (
              <ContactEditForm key={c.id} customerId={customer.id} c={contactsForClient.find((x) => x.id === c.id)!} />
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Opportunities</h2>
        {customer.opportunities.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-card/20 p-6 text-sm text-muted-foreground">
            No opportunities for this customer yet.{" "}
            <Link className="font-medium text-primary hover:underline" href={`/app/sales/opportunities/new?customerId=${customer.id}`}>
              Create an opportunity
            </Link>{" "}
            to capture lead intake and scope.
          </div>
        ) : (
          <div className="overflow-hidden rounded-sm border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Title</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Service</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customer.opportunities.map((o) => (
                  <tr key={o.id} className="bg-card/10">
                    <td className="px-4 py-2">
                      <Link href={`/app/sales/opportunities/${o.id}`} className="font-medium text-primary hover:underline">
                        {o.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{formatOpportunityStatus(o.status)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{o.serviceType}</td>
                    <td className="px-4 py-2 text-muted-foreground">{o.updatedAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canAuthorQuotes(ctx.role) && customer.quotes.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Quotes</h2>
          <div className="overflow-hidden rounded-sm border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Quote</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Opportunity</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customer.quotes.map((q) => (
                  <tr key={q.id} className="bg-card/10">
                    <td className="px-4 py-2">
                      <Link href={`/app/sales/quotes/${q.id}`} className="font-medium text-primary hover:underline">
                        #{q.displayNumber}: {q.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{formatQuoteStatus(q.status)}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      <Link href={`/app/sales/opportunities/${q.opportunity.id}`} className="text-primary hover:underline">
                        {q.opportunity.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{q.updatedAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        <div className="rounded-sm border border-border bg-card/10">
          {activity.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No recorded activity yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {e.eventType.replace(/_/g, " ")}
                    </span>
                    <time className="text-xs text-muted-foreground">{e.createdAt.toLocaleString()}</time>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{e.summary}</p>
                  {e.opportunity ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Opportunity:{" "}
                      <Link href={`/app/sales/opportunities/${e.opportunity.id}`} className="text-primary hover:underline">
                        {e.opportunity.title}
                      </Link>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
