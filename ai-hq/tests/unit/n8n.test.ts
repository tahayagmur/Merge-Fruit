import { afterEach, describe, expect, it, vi } from "vitest";
import { parseN8nConfig } from "@/lib/integrations/n8n/config";
import { getN8nService, getN8nStatus, IntegrationUnavailableError } from "@/lib/integrations/n8n/service";

const API_KEY = "n8n_test_key_abcdefghijklmnop";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseN8nConfig", () => {
  it("is not configured by default", () => {
    expect(parseN8nConfig({})).toEqual({ state: "not_configured" });
  });

  it("accepts an https base URL and a key", () => {
    const state = parseN8nConfig({ N8N_BASE_URL: "https://acme.app.n8n.cloud", N8N_API_KEY: API_KEY });
    expect(state.state).toBe("valid");
  });

  it.each([
    [{ N8N_BASE_URL: "http://acme.app.n8n.cloud", N8N_API_KEY: API_KEY }, "N8N_BASE_URL must use https."],
    [
      { N8N_BASE_URL: "https://user:pass@acme.app.n8n.cloud", N8N_API_KEY: API_KEY },
      "N8N_BASE_URL must not contain credentials, query strings or fragments.",
    ],
    [{ N8N_BASE_URL: "https://acme.app.n8n.cloud" }, "N8N_API_KEY is missing."],
    [{ N8N_BASE_URL: "https://acme.app.n8n.cloud", N8N_API_KEY: "short" }, "N8N_API_KEY looks too short."],
  ])("rejects insecure or incomplete settings (%#)", (env, issue) => {
    const state = parseN8nConfig(env);
    expect(state.state).toBe("invalid");
    expect(state.state === "invalid" && state.issues).toContain(issue);
  });
});

describe("n8n service (Phase 1)", () => {
  it("never connects, even when fully configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const service = getN8nService();

    expect(service.connected).toBe(false);
    await expect(service.listWorkflows()).rejects.toBeInstanceOf(IntegrationUnavailableError);
    await expect(
      service.dispatchAutomation({
        automationId: "11111111-1111-4111-8111-111111111111",
        workflowId: "wf_123",
        idempotencyKey: "0123456789abcdef0123",
      }),
    ).rejects.toBeInstanceOf(IntegrationUnavailableError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("validates dispatch requests before anything else", async () => {
    await expect(
      getN8nService().dispatchAutomation({
        automationId: "11111111-1111-4111-8111-111111111111",
        workflowId: "https://evil.example/webhook",
        idempotencyKey: "0123456789abcdef0123",
      }),
    ).rejects.not.toBeInstanceOf(IntegrationUnavailableError);
  });

  it("exposes a status object without URLs or secrets", () => {
    const status = getN8nStatus({ N8N_BASE_URL: "https://acme.app.n8n.cloud", N8N_API_KEY: API_KEY });
    expect(status).toMatchObject({ connected: false, configuration: "ready_for_phase_2", plannedPhase: 2 });
    const serialised = JSON.stringify(status);
    expect(serialised).not.toContain(API_KEY);
    expect(serialised).not.toContain("acme.app.n8n.cloud");
  });
});
