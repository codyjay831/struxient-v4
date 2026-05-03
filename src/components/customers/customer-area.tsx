import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Full-width customer module background (dark-first). */
export function CustomerWorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "min-h-[calc(100vh-3.5rem)] border-t border-border/50",
        "bg-background",
        "dark:bg-[linear-gradient(180deg,hsl(240_6%_6%)_0%,hsl(var(--background))_22rem)]",
      )}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}

export function CustomerBackLink({ href = "/app/customers" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5 shrink-0 opacity-80" aria-hidden />
      Customers
    </Link>
  );
}

export function CustomerPageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {badge ? <div className="flex flex-wrap items-center gap-2">{badge}</div> : null}
        </div>
        {subtitle ? <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CustomerSectionCard({
  title,
  description,
  children,
  className,
  headerClassName,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <Card className={cn("border-border/80 bg-card/40 shadow-none dark:bg-card/30", className)}>
      <CardHeader className={cn("space-y-1 pb-4 pt-5", headerClassName)}>
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-foreground">{title}</CardTitle>
        {description ? <CardDescription className="text-xs leading-relaxed">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="pb-5 pt-0">{children}</CardContent>
    </Card>
  );
}

export function MetadataPill({
  children,
  variant = "muted",
  className,
}: {
  children: ReactNode;
  variant?: "muted" | "accent" | "outline";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums",
        variant === "muted" && "border-transparent bg-muted/60 text-muted-foreground",
        variant === "accent" && "border-primary/35 bg-primary/10 text-primary",
        variant === "outline" && "border-border bg-background/80 text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function CustomerEmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card className="border-dashed border-border/90 bg-card/20 shadow-none dark:bg-card/15">
      <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:px-10">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
        {children ? <div className="mt-8 flex flex-wrap justify-center gap-2">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

export function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}
