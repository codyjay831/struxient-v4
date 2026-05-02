import Link from "next/link";
import { requireOrgSession } from "@/server/phase1/org-session";
import { listCustomersForOrg } from "@/server/phase1/queries";
import { Button } from "@/components/ui/button";
import { formatCustomerStatus } from "@/lib/format-enums";

function contactSummary(
  methods: { type: string; value: string; isPrimary: boolean; archivedAt: Date | null }[],
) {
  const active = methods.filter((m) => !m.archivedAt);
  if (active.length === 0) return "No contacts on file";
  const primary = active.find((m) => m.isPrimary) ?? active[0];
  const more = active.length > 1 ? ` +${active.length - 1}` : "";
  return `${primary.type}: ${primary.value}${more}`;
}

export default async function CustomersListPage() {
  const ctx = await requireOrgSession();
  const customers = await listCustomersForOrg(ctx.organizationId);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Customers</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Relationship records for the people and organizations you serve. Contacts live here; opportunities and
            quotes are managed under Sales.
          </p>
        </div>
        <Button asChild className="w-fit rounded-sm">
          <Link href="/app/customers/new">Create customer</Link>
        </Button>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-card/30 p-10 text-center">
          <p className="text-sm font-medium text-foreground">No customers yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a customer to capture who is requesting work before you open an opportunity.
          </p>
          <Button asChild className="mt-6 rounded-sm">
            <Link href="/app/customers/new">Create customer</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Contacts</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/20">
              {customers.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/app/customers/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.displayName}
                    </Link>
                  </td>
                  <td className="hidden max-w-xs truncate px-4 py-3 text-muted-foreground md:table-cell">
                    {contactSummary(c.contactMethods)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatCustomerStatus(c.status)}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {c.updatedAt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
