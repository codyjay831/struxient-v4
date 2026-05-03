"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Briefcase,
  Calendar,
  Layers,
  LayoutDashboard,
  Library,
  Settings,
  Shield,
  Target,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type NavKey =
  | "work-station"
  | "flowspec"
  | "jobs"
  | "schedule"
  | "customers"
  | "sales"
  | "work-templates"
  | "finance"
  | "admin"
  | "catalog"
  | "settings";

const navItems: {
  key: NavKey;
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  disabledReason?: string;
}[] = [
  { key: "work-station", label: "Work Station", href: "/app/work-station", icon: LayoutDashboard },
  { key: "flowspec", label: "FlowSpec Builder", icon: Workflow, disabledReason: "Workflow authoring ships in a later release." },
  { key: "jobs", label: "Jobs", href: "/app/jobs", icon: Briefcase },
  { key: "schedule", label: "Schedule", href: "/app/schedule", icon: Calendar },
  { key: "customers", label: "Customers", href: "/app/customers", icon: Users },
  { key: "sales", label: "Sales", href: "/app/sales/opportunities", icon: Target },
  { key: "work-templates", label: "Work templates", href: "/app/sales/templates", icon: Layers },
  { key: "finance", label: "Finance", icon: Banknote, disabledReason: "Finance and payment gates ship in a later release." },
  { key: "admin", label: "Admin", href: "/app/admin", icon: Shield },
  { key: "catalog", label: "Catalog", icon: Library, disabledReason: "Catalog ships in a later release." },
  { key: "settings", label: "Settings", href: "/app/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={200}>
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/30">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/app/work-station" className="text-sm font-semibold tracking-tight text-foreground">
            Struxient
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href ? pathname === item.href || pathname.startsWith(`${item.href}/`) : false;
            const isDisabled = !item.href;

            if (isDisabled) {
              return (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>
                    <span
                      role="group"
                      aria-disabled
                      className={cn(
                        "flex cursor-not-allowed items-center gap-2 rounded-sm px-2.5 py-2 text-sm text-muted-foreground opacity-60",
                      )}
                    >
                      <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    {item.disabledReason}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.key}
                href={item.href!}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
