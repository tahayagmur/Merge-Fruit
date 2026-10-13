import { describe, expect, it, vi } from "vitest";
import { getIntegrationDefinition, INTEGRATIONS } from "@/lib/integrations/registry";
import { computeIntegrationStatus, settingsHash } from "@/lib/integrations/status";
import type { IntegrationConfigRecord } from "@/lib/integrations/types";
import { buildIntegrationView, buildIntegrationViews } from "@/lib/integrations/views";

const n8n = getIntegrationDefinition("n8n")!;
const VALID = { baseUrl: "https://acme.app.n8n.cloud" };

function config(overrides: Partial<IntegrationConfigRecord> = {}): IntegrationConfigRecord {
  return {
    key: "n8n",
    enabled: true,
    settings: VALID,
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestedAt: null,
    testedSettingsHash: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("integration registry", () => {
  it("defines unique, well-formed keys with secrets referenced by env name only", () => {
    const keys = INTEGRATIONS.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const definition of INTEGRATIONS) {
      expect(definition.key).toMatch(/^[a-z][a-z0-9_-]{1,39}$/);
      for (const secret of definition.secrets) expect(secret.env).toMatch(/^[A-Z][A-Z0-9_]+$/);
      // Settings schemas never accept secret-looking fields.
      for (const field of definition.settingFields) {
        expect(field.key).not.toMatch(/secret|token|password|api_?key|private/i);
      }
    }
  });

  it("validates settings strictly", () => {
    expect(n8n.settingsSchema.safeParse(VALID).success).toBe(true);
    expect(n8n.settingsSchema.safeParse({ baseUrl: "http://acme.app.n8n.cloud" }).success).toBe(false);
    expect(n8n.settingsSchema.safeParse({ baseUrl: "https://u:p@acme.app.n8n.cloud" }).success).toBe(false);
    expect(n8n.settingsSchema.safeParse({ ...VALID, apiKey: "smuggled" }).success).toBe(false);
  });
});

describe("Hermes Agent definition", () => {
  const hermes = getIntegrationDefinition("hermes")!;
  const parse = (settings: Record<string, unknown>) => hermes.settingsSchema.safeParse(settings).success;

  it("needs only the Hermes API key; the model key stays in Hermes", () => {
    expect(hermes.category).toBe("ai");
    expect(hermes.secrets.map((secret) => secret.env)).toEqual(["HERMES_API_KEY"]);
  });

  it("allows plain http only inside a private network", () => {
    for (const baseUrl of [
      "http://127.0.0.1:8642",
      "http://localhost:8642",
      "http://hermes:8642",
      "http://192.168.1.20:8642",
      "http://10.0.0.5:8642",
      "http://100.101.102.103:8642",
      "http://my-pc.tailnet-abc.ts.net:8642",
      "https://hermes.example.com",
    ]) {
      expect(parse({ baseUrl }), baseUrl).toBe(true);
    }
    for (const baseUrl of [
      "http://hermes.example.com:8642",
      "http://8.8.8.8:8642",
      "http://172.32.0.1:8642",
      "https://user:pass@hermes.example.com",
      "http://127.0.0.1:8642/?key=x",
      "ftp://127.0.0.1",
    ]) {
      expect(parse({ baseUrl }), baseUrl).toBe(false);
    }
  });

  it("validates the provider name and rejects secret fields", () => {
    const base = { baseUrl: "http://127.0.0.1:8642" };
    expect(parse({ ...base, defaultProvider: "gemini", defaultModel: "some-model" })).toBe(true);
    expect(parse({ ...base, defaultProvider: "Gemini Pro!" })).toBe(false);
    expect(parse({ ...base, apiKey: "smuggled" })).toBe(false);
  });
});

describe("computeIntegrationStatus", () => {
  const allSecrets = { N8N_API_KEY: true, N8N_WEBHOOK_SIGNING_SECRET: false };

  it("is not configured while required settings or secrets are missing", () => {
    const missingSettings = computeIntegrationStatus({
      definition: n8n,
      config: null,
      secretsPresent: allSecrets,
      connectorAvailable: false,
    });
    expect(missingSettings.status).toBe("not_configured");
    expect(missingSettings.reasons.join(" ")).toContain("Instance URL");

    const missingSecret = computeIntegrationStatus({
      definition: n8n,
      config: config(),
      secretsPresent: { N8N_API_KEY: false },
      connectorAvailable: false,
    });
    expect(missingSecret.status).toBe("not_configured");
    expect(missingSecret.reasons.join(" ")).toContain("N8N_API_KEY");
  });

  it("is ready to configure — never connected — without a connector", () => {
    const result = computeIntegrationStatus({
      definition: n8n,
      config: config({ lastTestStatus: "succeeded", testedSettingsHash: settingsHash(VALID) }),
      secretsPresent: allSecrets,
      connectorAvailable: false,
    });
    expect(result.status).toBe("ready_to_configure");
  });

  it("is connected only after a successful test of the current settings", () => {
    const tested = config({ lastTestStatus: "succeeded", testedSettingsHash: settingsHash(VALID) });
    expect(
      computeIntegrationStatus({ definition: n8n, config: tested, secretsPresent: allSecrets, connectorAvailable: true }).status,
    ).toBe("connected");

    const changedSince = config({
      settings: { baseUrl: "https://other.app.n8n.cloud" },
      lastTestStatus: "succeeded",
      testedSettingsHash: settingsHash(VALID),
    });
    expect(
      computeIntegrationStatus({ definition: n8n, config: changedSince, secretsPresent: allSecrets, connectorAvailable: true })
        .status,
    ).toBe("ready_to_configure");

    const disabled = config({ enabled: false, lastTestStatus: "succeeded", testedSettingsHash: settingsHash(VALID) });
    expect(
      computeIntegrationStatus({ definition: n8n, config: disabled, secretsPresent: allSecrets, connectorAvailable: true }).status,
    ).toBe("ready_to_configure");
  });

  it("reports errors for invalid saved settings or a failed test", () => {
    expect(
      computeIntegrationStatus({
        definition: n8n,
        config: config({ settings: { baseUrl: "ftp://bad" } }),
        secretsPresent: allSecrets,
        connectorAvailable: false,
      }).status,
    ).toBe("error");
    expect(
      computeIntegrationStatus({
        definition: n8n,
        config: config({ lastTestStatus: "failed", lastTestMessage: "401", testedSettingsHash: settingsHash(VALID) }),
        secretsPresent: allSecrets,
        connectorAvailable: true,
      }),
    ).toEqual({ status: "error", reasons: ["401"] });
  });

  it("hashes settings independently of key order", () => {
    expect(settingsHash({ a: 1, b: 2 })).toBe(settingsHash({ b: 2, a: 1 }));
  });
});

describe("integration views", () => {
  it("expose secret presence but never secret values, and never claim a connection in this phase", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const views = buildIntegrationViews([config()], { N8N_API_KEY: "n8n_very_secret_value" });
    const view = views.find((item) => item.key === "n8n")!;
    expect(view.secrets.find((secret) => secret.env === "N8N_API_KEY")?.present).toBe(true);
    expect(JSON.stringify(views)).not.toContain("n8n_very_secret_value");
    expect(views.every((item) => item.status !== "connected" && !item.connectorAvailable)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("covers every registered integration", () => {
    expect(buildIntegrationViews([], {}).map((view) => view.key)).toEqual(INTEGRATIONS.map((item) => item.key));
    expect(buildIntegrationView(n8n, null, {}).status).toBe("not_configured");
  });
});
