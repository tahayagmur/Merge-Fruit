import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isNavItemActive, NAV_ITEMS } from "@/lib/navigation";
import { MODULE_PLANS, ROADMAP_PHASES } from "@/lib/roadmap";

const APP_DIR = path.resolve(__dirname, "../../src/app/(hq)");

describe("navigation", () => {
  it("lists the nine HQ sections in order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Command Center",
      "Projects",
      "Automation Center",
      "Game Studio",
      "SaaS & Business",
      "AI Agent Hub",
      "Integrations",
      "Activity Logs",
      "Settings",
    ]);
  });

  it.each(NAV_ITEMS.map((item) => [item.href]))("has a page for %s", (href) => {
    const file = href === "/" ? path.join(APP_DIR, "page.tsx") : path.join(APP_DIR, href, "page.tsx");
    expect(existsSync(file)).toBe(true);
  });

  it("links every module that is not live to a development plan", () => {
    for (const item of NAV_ITEMS.filter((candidate) => candidate.status !== "live")) {
      expect(item.planId, item.label).toBeDefined();
      const plan = MODULE_PLANS[item.planId!];
      expect(plan, item.label).toBeDefined();
      expect(plan.status).toBe(item.status);
      expect(ROADMAP_PHASES.some((phase) => phase.phase === plan.phase)).toBe(true);
    }
  });

  it("marks the right item active", () => {
    const projects = NAV_ITEMS[1];
    expect(isNavItemActive(projects, "/projects/123")).toBe(true);
    expect(isNavItemActive(NAV_ITEMS[0], "/projects")).toBe(false);
    expect(isNavItemActive(NAV_ITEMS[0], "/")).toBe(true);
  });
});
