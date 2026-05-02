import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id && session.user.organizationId) {
    redirect("/app/work-station");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-10 text-center">
          <Link href="/login" className="text-lg font-semibold tracking-tight text-foreground">
            Struxient
          </Link>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Internal operations workspace for contracting teams. Sign in with your organization credentials.
          </p>
        </div>
        <Card className="w-full max-w-md rounded-sm border-border shadow-lg shadow-black/40">
          <CardHeader>
            <CardTitle className="text-base">Staff sign-in</CardTitle>
            <CardDescription>Use the email and password provisioned for your organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-40 animate-pulse rounded-sm bg-muted" aria-hidden />}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
