import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

const { SidebarNav } = await import("@/components/layout/sidebar-nav");

beforeEach(() => {
  pathname.mockReturnValue("/");
});

describe("SidebarNav", () => {
  it("renders every section as a link", () => {
    render(<SidebarNav />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/projects",
      "/automation",
      "/game-studio",
      "/saas",
      "/agents",
      "/integrations",
      "/activity",
      "/settings",
    ]);
  });

  it("marks the current section, including nested routes", () => {
    pathname.mockReturnValue("/projects/123");
    render(<SidebarNav />);
    expect(screen.getByRole("link", { name: /Projects/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Command Center/ })).not.toHaveAttribute("aria-current");
  });

  it("labels modules that are not built yet instead of hiding them", () => {
    render(<SidebarNav />);
    for (const name of ["Game Studio", "SaaS & Business", "AI Agent Hub", "Integrations"]) {
      expect(screen.getByRole("link", { name: new RegExp(name) })).toHaveTextContent("Planned");
    }
    expect(screen.getByRole("link", { name: /Settings/ })).toHaveTextContent("Partial");
    expect(screen.getByRole("link", { name: /Automation Center/ })).not.toHaveTextContent(/Planned|Partial/);
  });

  it("calls onNavigate when a link is used (closes the mobile menu)", () => {
    const onNavigate = vi.fn();
    // jsdom cannot navigate between documents; stop the browser default only.
    const preventNavigation = (event: Event) => event.preventDefault();
    window.addEventListener("click", preventNavigation, { capture: true });
    render(<SidebarNav onNavigate={onNavigate} />);
    screen.getByRole("link", { name: /Activity Logs/ }).click();
    window.removeEventListener("click", preventNavigation, { capture: true });
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
