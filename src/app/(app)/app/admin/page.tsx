import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Admin</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Company-level controls for people, permissions, integrations, and defaults will be managed here. Access is
          limited to privileged roles; changes will be audited when governance ships.
        </p>
      </div>

      <Card className="rounded-sm border-border">
        <CardHeader>
          <CardTitle className="text-base">Organization administration</CardTitle>
          <CardDescription>Planned capabilities for this surface</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
            <li>User invitations and deactivation</li>
            <li>Role templates mapped to the Struxient permissions matrix</li>
            <li>Company profile, billing contacts, and integration credentials</li>
            <li>Workflow governance and publishing rules</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
