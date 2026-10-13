"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive, NAV_ITEMS, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const GROUPS: Array<{ label: string; hrefs: string[] }> = [
  { label: "Workspace", hrefs: ["/", "/projects", "/automation"] },
  { label: "Studios", hrefs: ["/game-studio", "/saas", "/agents"] },
  { label: "System", hrefs: ["/integrations", "/activity", "/settings"] },
];

const STATUS_TAG: Partial<Record<NavItem["status"], string>> = {
  planned: "Planned",
  partial: "Partial",
};

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const tag = STATUS_TAG[item.status];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
      )}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
      <Icon
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-sidebar-accent-foreground",
          active && "text-primary",
        )}
      />
      <span className="truncate">{item.label}</span>
      {tag && (
        <span className="ml-auto rounded border border-border px-1.5 py-px font-mono text-[0.6rem] tracking-wide text-muted-foreground uppercase">
          {tag}
        </span>
      )}
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="hq-label px-3 pb-1">{group.label}</p>
          {group.hrefs.map((href) => {
            const item = NAV_ITEMS.find((candidate) => candidate.href === href);
            if (!item) return null;
            return (
              <NavLink
                key={item.href}
                item={item}
                active={pathname ? isNavItemActive(item, pathname) : false}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Navigation with active-state highlighting. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <NavList pathname={pathname} onNavigate={onNavigate} />;
}

/** Same navigation without the pathname, used as a Suspense fallback during prerendering. */
export function SidebarNavFallback() {
  return <NavList pathname={null} />;
}
