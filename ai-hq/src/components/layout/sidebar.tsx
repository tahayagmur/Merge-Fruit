import { MapIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { SidebarNav, SidebarNavFallback } from "./sidebar-nav";

export function SidebarContent() {
  return (
    <div className="flex h-full flex-col gap-8 px-3 py-5">
      <Link href="/" className="px-3" aria-label="AI HQ home">
        <Logo />
      </Link>
      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<SidebarNavFallback />}>
          <SidebarNav />
        </Suspense>
      </div>
      <Link
        href="/roadmap"
        className="mx-1 flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
      >
        <MapIcon className="size-4 text-primary" />
        <span className="flex flex-col">
          <span className="font-medium text-foreground">Phase 2 · Core system</span>
          <span>View development plan</span>
        </span>
      </Link>
    </div>
  );
}
