import Link from "next/link";
import { CustomerCreateForm } from "./customer-create-form";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="space-y-1">
        <Link href="/app/customers" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          ← Customers
        </Link>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">New customer</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Create a durable customer record before capturing opportunities and quotes.
        </p>
      </div>
      <CustomerCreateForm />
    </div>
  );
}
