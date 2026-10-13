import {
  Activity,
  Bot,
  Briefcase,
  FolderKanban,
  Gamepad2,
  LayoutDashboard,
  type LucideIcon,
  Plug,
  Settings,
  Workflow,
} from "lucide-react";
import type { ModuleStatus } from "@/lib/roadmap";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  status: ModuleStatus;
  /** Key into MODULE_PLANS for modules that render the roadmap. */
  planId?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Command Center", icon: LayoutDashboard, status: "live" },
  { href: "/projects", label: "Projects", icon: FolderKanban, status: "live" },
  { href: "/automation", label: "Automation Center", icon: Workflow, status: "live" },
  { href: "/game-studio", label: "Game Studio", icon: Gamepad2, status: "planned", planId: "game-studio" },
  { href: "/saas", label: "SaaS & Business", icon: Briefcase, status: "planned", planId: "saas" },
  { href: "/agents", label: "AI Agent Hub", icon: Bot, status: "planned", planId: "agents" },
  { href: "/integrations", label: "Integrations", icon: Plug, status: "planned", planId: "integrations" },
  { href: "/activity", label: "Activity Logs", icon: Activity, status: "live" },
  { href: "/settings", label: "Settings", icon: Settings, status: "partial", planId: "settings" },
];

export function isNavItemActive(item: Pick<NavItem, "href">, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
