import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Personal preferences and notification controls will live here. Struxient v4 currently runs in a fixed dark
          interface to keep the product visually consistent while foundational screens are built out.
        </p>
      </div>

      <Card className="rounded-sm border-border">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Read-only details from your authenticated session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-foreground">{session?.user?.email ?? "—"}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">Display name</span>
            <span className="font-medium text-foreground">{session?.user?.name?.trim() || "Not set"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
