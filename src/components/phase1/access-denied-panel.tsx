import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AccessDeniedPanel(props: { title: string; description: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-sm border border-border bg-card/50 p-6 shadow-sm">
        <h1 className="text-base font-semibold text-foreground">{props.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{props.description}</p>
        <Button asChild variant="outline" size="sm" className="rounded-sm">
          <Link href="/app/work-station">Back to Work Station</Link>
        </Button>
      </div>
    </div>
  );
}
