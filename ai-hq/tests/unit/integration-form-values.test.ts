import { describe, expect, it } from "vitest";
import { NOT_SET, toFormValue, toSettings } from "@/lib/integrations/form-values";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import type { SettingField } from "@/lib/integrations/types";

const fields: SettingField[] = [
  { key: "baseUrl", label: "URL", type: "url", required: true },
  { key: "timeout", label: "Timeout", type: "number", required: false },
  { key: "mode", label: "Mode", type: "select", required: false, options: [{ value: "test", label: "Test" }] },
  { key: "packages", label: "Packages", type: "list", required: false },
];

describe("integration form values", () => {
  it("round-trips stored settings through the form", () => {
    const stored = { baseUrl: "https://example.app.n8n.cloud", timeout: 30, mode: "test", packages: ["com.a.b", "com.c.d"] };
    const values = Object.fromEntries(fields.map((field) => [field.key, toFormValue(field, stored[field.key as keyof typeof stored])]));
    expect(values).toEqual({ baseUrl: stored.baseUrl, timeout: "30", mode: "test", packages: "com.a.b\ncom.c.d" });
    expect(toSettings(fields, values)).toEqual(stored);
  });

  it("leaves out empty optional values instead of sending blanks", () => {
    const empty = Object.fromEntries(fields.map((field) => [field.key, toFormValue(field, undefined)]));
    expect(empty.mode).toBe(NOT_SET);
    expect(toSettings(fields, empty)).toEqual({});
    expect(toSettings(fields, { baseUrl: "  ", timeout: " ", mode: NOT_SET, packages: "\n \n" })).toEqual({});
  });

  it("trims text and list entries", () => {
    expect(toSettings(fields, { baseUrl: "  https://x.example  ", packages: " com.a.b \n\n com.c.d " })).toEqual({
      baseUrl: "https://x.example",
      packages: ["com.a.b", "com.c.d"],
    });
  });

  it("produces values the integration schema accepts", () => {
    const n8n = getIntegrationDefinition("n8n");
    expect(n8n).toBeDefined();
    const settings = toSettings(n8n!.settingFields, { baseUrl: "https://studio.app.n8n.cloud", requestTimeoutSeconds: "20" });
    expect(n8n!.settingsSchema.safeParse(settings).success).toBe(true);
    // A pasted URL with credentials is still rejected by the server-side schema.
    const unsafe = toSettings(n8n!.settingFields, { baseUrl: "https://user:pass@studio.app.n8n.cloud" });
    expect(n8n!.settingsSchema.safeParse(unsafe).success).toBe(false);
  });
});
