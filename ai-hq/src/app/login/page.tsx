import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getServerEnvStatus } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  forbidden: "This account is not allowed to use AI HQ. Sign in with an authorized account.",
};

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div className="hq-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <Logo className="mb-8 justify-center" />
        <Card className="gap-5">
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>Sign in</h1>
            </CardTitle>
            <CardDescription>Private workspace. Accounts are created by the administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<LoginFormSkeleton />}>
              <LoginPanel searchParams={props.searchParams} />
            </Suspense>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">Sessions are verified on the server.</p>
      </div>
    </main>
  );
}

async function LoginPanel({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const notice = typeof params.error === "string" ? NOTICES[params.error] : undefined;

  const config = getServerEnvStatus();
  // Only development builds list the missing variables; production shows a generic notice.
  const configIssues = config.ok ? undefined : process.env.NODE_ENV === "production" ? [] : config.issues;

  return <LoginForm next={next} notice={notice} configIssues={configIssues} />;
}

function LoginFormSkeleton() {
  return (
    <div className="grid gap-5" aria-hidden>
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-10" />
    </div>
  );
}
