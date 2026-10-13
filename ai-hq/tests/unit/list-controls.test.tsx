import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { FilterChips } = await import("@/components/common/filter-chips");
const { Pagination } = await import("@/components/common/pagination");
const { SearchForm } = await import("@/components/common/search-form");

describe("FilterChips", () => {
  it("marks the active option and keeps other filters but resets the page", () => {
    render(
      <FilterChips
        label="Status"
        param="status"
        current="active"
        basePath="/projects"
        params={{ status: "active", q: "alpha", page: "3" }}
        options={[
          { value: "planning", label: "Planning" },
          { value: "active", label: "Active" },
        ]}
      />,
    );
    const group = screen.getByRole("group", { name: "Filter by status" });
    expect(within(group).getByRole("link", { name: "Active" })).toHaveAttribute("aria-current", "true");
    expect(within(group).getByRole("link", { name: "Planning" })).toHaveAttribute("href", "/projects?q=alpha&status=planning");
    expect(within(group).getByRole("link", { name: "All" })).toHaveAttribute("href", "/projects?q=alpha");
  });
});

describe("Pagination", () => {
  it("shows the range and links to neighbouring pages with the current filters", () => {
    render(<Pagination page={2} pageSize={10} total={25} params={{ status: "draft", page: "2" }} basePath="/automation" label="automations" />);
    expect(screen.getByText("11–20 of 25 automations")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Previous/ })).toHaveAttribute("href", "/automation?status=draft");
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute("href", "/automation?status=draft&page=3");
  });

  it("disables links at the edges and renders nothing without results", () => {
    const { rerender, container } = render(<Pagination page={1} pageSize={10} total={5} params={{}} basePath="/agents" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    rerender(<Pagination page={1} pageSize={10} total={0} params={{}} basePath="/agents" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SearchForm", () => {
  it("submits the trimmed term, keeps filters and drops the page", () => {
    push.mockClear();
    render(<SearchForm basePath="/agents" params={{ status: "ready", page: "4", q: "old" }} label="Search agents" />);
    const input = screen.getByRole("searchbox", { name: "Search agents" });
    fireEvent.change(input, { target: { value: "  writer  " } });
    fireEvent.submit(input.closest("form")!);
    expect(push).toHaveBeenCalledWith("/agents?status=ready&q=writer");
  });

  it("clears the search", () => {
    push.mockClear();
    render(<SearchForm basePath="/activity" defaultValue="deploy" label="Search activity" />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(push).toHaveBeenCalledWith("/activity");
    expect(screen.getByRole("searchbox", { name: "Search activity" })).toHaveValue("");
  });
});
