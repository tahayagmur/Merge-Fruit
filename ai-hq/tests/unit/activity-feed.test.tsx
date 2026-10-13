import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityFeed } from "@/components/activity/activity-feed";
import type { ActivityEntry } from "@/lib/domain";

const now = new Date("2026-10-13T12:00:00Z");

const entries: ActivityEntry[] = [
  {
    id: 2,
    ownerId: "u1",
    actorId: "u2",
    entityType: "task",
    entityId: "t1",
    action: "status_changed",
    summary: "Task Ship v1: todo -> done",
    metadata: { from: "todo", to: "done" },
    createdAt: "2026-10-13T10:00:00Z",
  },
  {
    id: 1,
    ownerId: "u1",
    actorId: null,
    entityType: "project",
    entityId: "p1",
    action: "created",
    summary: "Project created: AI HQ",
    metadata: {},
    createdAt: "2026-10-12T12:00:00Z",
  },
];

describe("ActivityFeed", () => {
  it("renders entries in order with relative times", () => {
    render(<ActivityFeed entries={entries} now={now} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Task Ship v1: todo -> done");
    expect(items[0]).toHaveTextContent("2 hours ago");
    expect(items[1]).toHaveTextContent("yesterday");
  });

  it("names who made each change only in the workspace audit view", () => {
    const { rerender } = render(<ActivityFeed entries={entries} now={now} />);
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    rerender(<ActivityFeed entries={entries} now={now} actorNames={{ u2: "Bob" }} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Bob");
    expect(items[1]).toHaveTextContent("Deleted user");
  });

  it("exposes machine-readable timestamps", () => {
    render(<ActivityFeed entries={entries} now={now} />);
    expect(screen.getByText("2 hours ago").closest("time")).toHaveAttribute("dateTime", "2026-10-13T10:00:00Z");
  });
});
