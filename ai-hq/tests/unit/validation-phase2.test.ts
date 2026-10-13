import { describe, expect, it } from "vitest";
import { agentCreateSchema, agentTaskUpdateSchema, agentUpdateSchema } from "@/lib/validation/agents";
import { automationCreateSchema } from "@/lib/validation/automations";
import { sanitizeSearchTerm, searchQuerySchema } from "@/lib/validation/common";
import { projectListQuerySchema } from "@/lib/validation/projects";
import {
  isValidTimeZone,
  passwordChangeSchema,
  profileUpdateSchema,
  roleUpdateSchema,
  systemSettingsUpdateSchema,
} from "@/lib/validation/settings";

describe("search terms", () => {
  it("strips characters that could alter PostgREST filters or act as wildcards", () => {
    expect(sanitizeSearchTerm('foo),name.eq."x"%_*')).toBe("foo name eq x");
    expect(sanitizeSearchTerm("  Görev   planı  ")).toBe("Görev planı");
    expect(searchQuerySchema.parse("a")).toBeUndefined();
    expect(searchQuerySchema.parse("%%")).toBeUndefined();
    expect(searchQuerySchema.parse("release")).toBe("release");
  });

  it("coerces pages and rejects out-of-range values", () => {
    expect(projectListQuerySchema.parse({ page: "3" })).toMatchObject({ page: 3 });
    expect(projectListQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });
});

describe("automation workflow references", () => {
  it("requires a known workflow engine when a workflow id is set", () => {
    expect(automationCreateSchema.safeParse({ name: "x", externalWorkflowId: "wf_1" }).success).toBe(false);
    expect(automationCreateSchema.parse({ name: "x", provider: "n8n", externalWorkflowId: "wf_1" })).toMatchObject({
      provider: "n8n",
      externalWorkflowId: "wf_1",
    });
    expect(automationCreateSchema.safeParse({ name: "x", provider: "anthropic" }).success).toBe(false);
  });
});

describe("agents", () => {
  it("applies defaults and de-duplicates capabilities", () => {
    expect(agentCreateSchema.parse({ name: "Analyst", capabilities: ["research", "research"] })).toEqual({
      name: "Analyst",
      description: null,
      instructions: "",
      provider: null,
      model: null,
      capabilities: ["research"],
      status: "draft",
    });
  });

  it("only allows AI providers and known capabilities", () => {
    expect(agentCreateSchema.safeParse({ name: "x", provider: "n8n" }).success).toBe(false);
    expect(agentCreateSchema.safeParse({ name: "x", capabilities: ["hack"] }).success).toBe(false);
    expect(agentCreateSchema.parse({ name: "x", provider: "anthropic" }).provider).toBe("anthropic");
    expect(agentUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("lets users cancel tasks but never set results or other states", () => {
    expect(agentTaskUpdateSchema.parse({ status: "cancelled" })).toEqual({ status: "cancelled" });
    expect(agentTaskUpdateSchema.safeParse({ status: "succeeded" }).success).toBe(false);
    expect(agentTaskUpdateSchema.safeParse({ output: "fake" }).success).toBe(false);
  });
});

describe("settings and account", () => {
  it("validates time zones", () => {
    expect(isValidTimeZone("Europe/Istanbul")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(systemSettingsUpdateSchema.safeParse({ timezone: "Mars/Olympus" }).success).toBe(false);
    expect(systemSettingsUpdateSchema.parse({ workspaceName: " Tamga HQ " })).toEqual({ workspaceName: "Tamga HQ" });
  });

  it("validates roles and display names", () => {
    expect(roleUpdateSchema.safeParse({ role: "superuser" }).success).toBe(false);
    expect(profileUpdateSchema.parse({ displayName: "  " })).toEqual({ displayName: null });
  });

  it("enforces the password policy and confirmation", () => {
    const base = { currentPassword: "Old-Passw0rd-1", newPassword: "New-Passw0rd-2", confirmPassword: "New-Passw0rd-2" };
    expect(passwordChangeSchema.safeParse(base).success).toBe(true);
    expect(passwordChangeSchema.safeParse({ ...base, newPassword: "short1A", confirmPassword: "short1A" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ ...base, newPassword: "alllowercase123", confirmPassword: "alllowercase123" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ ...base, confirmPassword: "different" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ ...base, newPassword: base.currentPassword, confirmPassword: base.currentPassword }).success).toBe(false);
  });
});
