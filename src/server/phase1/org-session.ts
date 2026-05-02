import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { MembershipRole } from "@prisma/client";

export type OrgSessionContext = {
  userId: string;
  organizationId: string;
  organizationName: string;
  role: MembershipRole;
  email: string;
  name: string | null | undefined;
};

export async function requireOrgSession(): Promise<OrgSessionContext> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { organizationId, organizationName, role, email, name } = session.user;
  if (!organizationId || !organizationName || !role) {
    redirect("/login");
  }
  return {
    userId: session.user.id,
    organizationId,
    organizationName,
    role,
    email: email ?? "",
    name,
  };
}
