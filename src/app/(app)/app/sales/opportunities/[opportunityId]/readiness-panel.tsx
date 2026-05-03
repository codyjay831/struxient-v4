import type { QuoteDraftReadinessItem } from "@/server/phase1/readiness";
import { allQuoteDraftBlockersPass } from "@/server/phase1/readiness";

function statusStyle(s: QuoteDraftReadinessItem["status"]) {
  if (s === "PASS") return "text-emerald-700 dark:text-emerald-400";
  if (s === "FAIL") return "text-destructive";
  if (s === "WAIVED") return "text-amber-800 dark:text-amber-400";
  return "text-muted-foreground";
}

export function ReadinessPanel(props: { items: QuoteDraftReadinessItem[] }) {
  const ready = allQuoteDraftBlockersPass(props.items);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Readiness for quote workspace</h2>
        <span
          className={`rounded-sm border px-2 py-0.5 text-xs font-medium ${
            ready
              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "border-border text-muted-foreground"
          }`}
        >
          {ready ? "Checks satisfied" : "Action required"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Derived on the server from current facts. These checks must pass before a quote draft can be created from this
        opportunity.
      </p>
      <ul className="divide-y divide-border rounded-sm border border-border bg-card/20">
        {props.items.map((item) => (
          <li key={item.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.explanation}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Fix: {item.fixLocation} · {item.severity}
              </p>
            </div>
            <span className={`shrink-0 text-xs font-semibold ${statusStyle(item.status)}`}>{item.status.replace(/_/g, " ")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NextActionCallout(props: { items: QuoteDraftReadinessItem[]; isClosed: boolean }) {
  if (props.isClosed) {
    return null;
  }
  const firstFail = props.items.find((i) => i.status === "FAIL");
  if (firstFail) {
    return (
      <div className="rounded-sm border border-border bg-card/40 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended next step</p>
        <p className="mt-1 text-sm text-foreground">
          {firstFail.label}: {firstFail.explanation}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-sm border border-border bg-card/40 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended next step</p>
      <p className="mt-1 text-sm text-foreground">
        Intake checks are satisfied. Create a quote draft when you are ready to price and plan execution in the quote
        workspace.
      </p>
    </div>
  );
}
