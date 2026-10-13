import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { safeRedirectPath } from "@/lib/auth/access";
import { getAuthContext } from "@/lib/auth/session";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Two-factor sign-in" };

export default function MfaPage(props: PageProps<"/login/mfa">) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div className="hq-grid pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-sm">
        <Logo className="mb-8 justify-center" />
        <Card className="gap-5">
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>Two-factor sign-in</h1>
            </CardTitle>
            <CardDescription>Enter the 6-digit code from your authenticator app.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Suspense fallback={<Skeleton className="h-28" />}>
              <MfaPanel searchParams={props.searchParams} />
            </Suspense>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground">
                Use another account
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lost your phone? An administrator can remove the authenticator in Supabase Auth.
        </p>
      </div>
    </main>
  );
}

async function MfaPanel({ searchParams }: { searchParams: PageProps<"/login/mfa">["searchParams"] }) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : undefined);
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "forbidden") redirect("/login?error=forbidden");
  if (auth.status === "authenticated") redirect(next);
  return <MfaForm next={next === "/" ? undefined : next} />;
}
