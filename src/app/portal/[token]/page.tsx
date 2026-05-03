import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPortalViewByRawToken } from "@/server/phase8/portal-projection";
import { PortalCustomerView } from "./portal-customer-view";

export const metadata: Metadata = {
  title: "Project portal",
  description: "Customer-facing project and proposal status",
};

export default async function CustomerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  const view = await getPortalViewByRawToken(decoded);
  if (!view) {
    notFound();
  }
  return <PortalCustomerView view={view} rawToken={decoded} />;
}
