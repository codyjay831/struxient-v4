import type { Session } from "next-auth";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";

export function AppShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const user = session.user;
  if (!user.organizationId || !user.organizationName || !user.role) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          organizationName={user.organizationName}
          email={user.email ?? ""}
          name={user.name}
          role={user.role}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
