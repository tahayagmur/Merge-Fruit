import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { EnvBadge } from "./env-badge";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

async function SessionArea() {
  const { user } = await requireUser();
  const env = getServerEnv();
  return (
    <div className="flex items-center gap-3">
      <EnvBadge env={env.appEnv} />
      <UserMenu email={user.email} />
    </div>
  );
}

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-10">
        <MobileNav />
        <div className="flex-1" />
        <Suspense fallback={<Skeleton className="h-8 w-48" />}>
          <SessionArea />
        </Suspense>
      </div>
    </header>
  );
}
