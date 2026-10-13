import { describe, expect, it } from "vitest";
import { activityQuerySchema } from "@/lib/validation/activity";
import { automationCreateSchema, automationUpdateSchema } from "@/lib/validation/automations";
import { projectCreateSchema, projectListQuerySchema, projectUpdateSchema } from "@/lib/validation/projects";
import { taskCreateSchema, taskUpdateSchema } from "@/lib/validation/tasks";

describe("project validation", () => {
  it("applies defaults and trims input", () => {
    expect(projectCreateSchema.parse({ name: "  AI HQ  ", description: "  " })).toEqual({
      name: "AI HQ",
      description: null,
      status: "planning",
      category: "general",
      priority: "medium",
      dueDate: null,
    });
  });

  it("rejects client-supplied ownership and unknown fields", () => {
    const result = projectCreateSchema.safeParse({ name: "x", owner_id: "00000000-0000-4000-8000-000000000000" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].code).toBe("unrecognized_keys");
  });

  it("validates names, enums and dates", () => {
    expect(projectCreateSchema.safeParse({ name: "" }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ name: "x".repeat(121) }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ name: "x", status: "done" }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ name: "x", dueDate: "2026-02-30" }).success).toBe(false);
    expect(projectCreateSchema.parse({ name: "x", dueDate: "2026-12-31" }).dueDate).toBe("2026-12-31");
  });

  it("requires at least one field on update and allows clearing values", () => {
    expect(projectUpdateSchema.safeParse({}).success).toBe(false);
    expect(projectUpdateSchema.parse({ dueDate: "" })).toEqual({ dueDate: null });
  });

  it("validates list filters", () => {
    expect(projectListQuerySchema.parse({ status: "active", category: "game" })).toEqual({ status: "active", category: "game" });
    expect(projectListQuerySchema.safeParse({ status: "deleted" }).success).toBe(false);
  });
});

describe("task validation", () => {
  it("applies defaults", () => {
    expect(taskCreateSchema.parse({ title: "Ship it" })).toMatchObject({ status: "todo", priority: "medium", dueDate: null });
  });

  it("rejects moving tasks between projects through the update payload", () => {
    expect(taskUpdateSchema.safeParse({ projectId: "00000000-0000-4000-8000-000000000000" }).success).toBe(false);
  });
});

describe("automation validation", () => {
  it("accepts workflow identifiers but never URLs or keys", () => {
    expect(automationCreateSchema.parse({ name: "Digest", n8nWorkflowId: "aBc-123_x" }).n8nWorkflowId).toBe("aBc-123_x");
    for (const value of ["https://n8n.example/webhook/abc", "abc def", "x".repeat(65)]) {
      expect(automationCreateSchema.safeParse({ name: "Digest", n8nWorkflowId: value }).success).toBe(false);
    }
  });

  it("normalises empty optional references to null", () => {
    expect(automationCreateSchema.parse({ name: "Digest", projectId: "", n8nWorkflowId: "" })).toMatchObject({
      projectId: null,
      n8nWorkflowId: null,
    });
    expect(automationCreateSchema.safeParse({ name: "Digest", projectId: "not-a-uuid" }).success).toBe(false);
  });

  it("requires at least one field on update", () => {
    expect(automationUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("activity query validation", () => {
  it("coerces and bounds pagination", () => {
    expect(activityQuerySchema.parse({ limit: "20", before: "15" })).toEqual({ limit: 20, before: 15 });
    expect(activityQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(activityQuerySchema.parse({})).toEqual({ limit: 50 });
  });
});
