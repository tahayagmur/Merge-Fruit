import { describe, expect, it, vi } from "vitest";
import { demoAgents, demoProjects, DEMO_PREFIX } from "@/lib/demo/dataset";
import { loadDemoData } from "@/lib/demo/service";

describe("demo dataset", () => {
  it("labels every top-level record as demo", () => {
    for (const { project, automations } of demoProjects()) {
      expect(project.name.startsWith(DEMO_PREFIX)).toBe(true);
      for (const automation of automations) expect(automation.name.startsWith(DEMO_PREFIX)).toBe(true);
    }
    for (const { agent } of demoAgents()) expect(agent.name.startsWith(DEMO_PREFIX)).toBe(true);
  });

  it("only queues agent tasks on ready agents (the database rejects anything else)", () => {
    for (const { agent, tasks } of demoAgents()) {
      if (tasks.length > 0) expect(agent.status).toBe("ready");
    }
  });
});

describe("loadDemoData", () => {
  it("refuses to run in production before touching the database", async () => {
    const supabase = { from: vi.fn() };
    await expect(loadDemoData(supabase as never, "user", "production")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
