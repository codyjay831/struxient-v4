import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const futureLanes = [
  { title: "Now", description: "Immediate actions assigned to you or your crew." },
  { title: "Blocked", description: "Work stopped on dependencies, access, permits, or customer decisions." },
  { title: "Waiting", description: "In progress but idle on a response, schedule window, or material." },
  { title: "Needs Review", description: "Approvals, QC checkpoints, or management sign-off." },
  { title: "Scheduled", description: "Time-bound visits, installs, and inspections on the calendar." },
] as const;

export default function WorkStationPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Work Station</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your operational command center for what needs attention across sales and production. The live work feed,
          assignments, and cross-module drill-ins will connect here as execution data comes online in later phases.
        </p>
      </div>

      <Card className="rounded-sm border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Command center layout</CardTitle>
          <CardDescription>
            Lane structure below mirrors how Struxient will prioritize work once tasks and gates are wired in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {futureLanes.map((lane, index) => (
            <div key={lane.title}>
              {index > 0 ? <Separator className="my-0 bg-border" /> : null}
              <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{lane.title}</p>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">{lane.description}</p>
                </div>
                <span className="shrink-0 pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Empty
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
