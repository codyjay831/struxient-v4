import type { ReactNode } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!session.user.organizationId || !session.user.organizationName || !session.user.role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md space-y-2 text-center">
          <h1 className="text-lg font-semibold text-foreground">No organization access</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You are signed in, but no organization membership was found for this account. Ask an administrator to assign
            you to an organization before using Struxient.
          </p>
        </div>
      </div>
    );
  }

  return <AppShell session={session}>{children}</AppShell>;
}
