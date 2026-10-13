import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadge } from "@/components/common/status-badges";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getServerEnv } from "@/lib/env";
import { EnvBadge } from "./env-badge";
import { GlobalSearch } from "./global-search";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

async function SessionArea() {
  const { user, profile, settings } = await requireWorkspace();
  const env = getServerEnv();
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs text-muted-foreground xl:inline" title="Workspace">
        {settings.workspaceName}
      </span>
      <span className="hidden md:inline-flex">
        <RoleBadge role={profile.role} />
      </span>
      <EnvBadge env={env.appEnv} />
      <UserMenu email={user.email} displayName={profile.displayName} />
    </div>
  );
}

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-10">
        <MobileNav />
        <div className="hidden flex-1 sm:block">
          <GlobalSearch />
        </div>
        <div className="flex-1 sm:hidden" />
        <Suspense fallback={<Skeleton className="h-8 w-48" />}>
          <SessionArea />
        </Suspense>
      </div>
    </header>
  );
}
