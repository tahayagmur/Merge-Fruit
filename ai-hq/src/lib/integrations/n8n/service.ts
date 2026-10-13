import "server-only";

import { z } from "zod";
import { n8nWorkflowIdSchema } from "@/lib/validation/automations";
import { parseN8nConfig, type N8nConfigState } from "./config";

/**
 * Server-side boundary for everything n8n. UI and API code talk to this
 * interface only, so Phase 2 can plug in the HTTP adapter without touching
 * callers. Secrets stay inside the adapter; nothing here is client-safe except
 * the status object.
 *
 * Scope: AI HQ connects to workflows that already exist in the owner's n8n
 * Cloud account (listing and triggering them). It deliberately has no way to
 * create, edit or delete workflows.
 */

export const N8N_CONNECTION_PHASE = 2;

export const automationDispatchSchema = z.strictObject({
  automationId: z.uuid(),
  workflowId: n8nWorkflowIdSchema,
  /** Used by n8n to drop duplicate deliveries. */
  idempotencyKey: z.string().min(16).max(128),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type AutomationDispatchRequest = z.input<typeof automationDispatchSchema>;

export interface AutomationDispatchResult {
  executionId: string;
  acceptedAt: string;
}

export interface N8nWorkflowSummary {
  id: string;
  name: string;
  active: boolean;
}

export interface N8nService {
  readonly connected: boolean;
  listWorkflows(): Promise<N8nWorkflowSummary[]>;
  dispatchAutomation(request: AutomationDispatchRequest): Promise<AutomationDispatchResult>;
}

export class IntegrationUnavailableError extends Error {
  readonly code = "INTEGRATION_UNAVAILABLE";

  constructor(message = `n8n is not connected yet. The connection is planned for Phase ${N8N_CONNECTION_PHASE}.`) {
    super(message);
    this.name = "IntegrationUnavailableError";
  }
}

/** Client-safe description of the integration. Contains no URLs or keys. */
export interface IntegrationStatus {
  id: "n8n";
  name: string;
  connected: false;
  configuration: "not_configured" | "invalid" | "ready_for_phase_2";
  configurationIssues: string[];
  plannedPhase: number;
  message: string;
}

export function describeN8nStatus(state: N8nConfigState): IntegrationStatus {
  const base = { id: "n8n" as const, name: "n8n Cloud", connected: false as const, plannedPhase: N8N_CONNECTION_PHASE };
  switch (state.state) {
    case "not_configured":
      return {
        ...base,
        configuration: "not_configured",
        configurationIssues: [],
        message: "Automation entries are a catalogue until Phase 2 links them to your existing n8n workflows.",
      };
    case "invalid":
      return {
        ...base,
        configuration: "invalid",
        // Issue texts name variables and rules only, never their values.
        configurationIssues: state.issues,
        message: "n8n variables are present but invalid. Fix them before Phase 2 enables the connection.",
      };
    case "valid":
      return {
        ...base,
        configuration: "ready_for_phase_2",
        configurationIssues: [],
        message: "Server variables are in place. The connection itself is enabled in Phase 2.",
      };
  }
}

/** Phase 1 implementation: refuses every call and never touches the network. */
class DisconnectedN8nService implements N8nService {
  readonly connected = false;

  async listWorkflows(): Promise<N8nWorkflowSummary[]> {
    throw new IntegrationUnavailableError();
  }

  async dispatchAutomation(request: AutomationDispatchRequest): Promise<AutomationDispatchResult> {
    automationDispatchSchema.parse(request);
    throw new IntegrationUnavailableError();
  }
}

export function getN8nStatus(source: Record<string, string | undefined> = process.env): IntegrationStatus {
  return describeN8nStatus(parseN8nConfig(source));
}

export function getN8nService(): N8nService {
  return new DisconnectedN8nService();
}
