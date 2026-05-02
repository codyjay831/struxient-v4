import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { logoutAction } from "@/app/(app)/app/actions";
import type { MembershipRole } from "@prisma/client";

function formatRole(role: MembershipRole) {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function AppHeader(props: {
  organizationName: string;
  email: string;
  name?: string | null;
  role: MembershipRole;
}) {
  const { organizationName, email, name, role } = props;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/40 px-4 backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{organizationName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {name?.trim() ? `${name} · ${email}` : email}
          <span className="mx-1.5 text-border">·</span>
          {formatRole(role)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm" className="rounded-sm">
            Log out
          </Button>
        </form>
      </div>
    </header>
  );
}
