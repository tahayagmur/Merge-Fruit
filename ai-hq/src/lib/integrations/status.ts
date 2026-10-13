import { createHash } from "node:crypto";
import type { IntegrationConfigRecord, IntegrationDefinition, IntegrationStatus } from "./types";

/** Stable hash of settings, so a test result only counts for the settings it was run with. */
export function settingsHash(settings: Record<string, unknown>): string {
  const canonical = JSON.stringify(settings, Object.keys(settings).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

export interface StatusInput {
  definition: IntegrationDefinition;
  config: IntegrationConfigRecord | null;
  secretsPresent: Record<string, boolean>;
  connectorAvailable: boolean;
}

export interface StatusResult {
  status: IntegrationStatus;
  reasons: string[];
}

function isBlank(value: unknown) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

/**
 * Status rules:
 * - connected:           a connector exists, the integration is enabled and the
 *                        last connection test succeeded for the CURRENT settings.
 *                        Nothing else can produce this state.
 * - error:               saved settings are invalid, or the last test for the
 *                        current settings failed.
 * - ready_to_configure:  all required settings and secrets are present; the
 *                        connection has not been verified (yet).
 * - not_configured:      required settings or secrets are missing.
 */
export function computeIntegrationStatus({
  definition,
  config,
  secretsPresent,
  connectorAvailable,
}: StatusInput): StatusResult {
  const settings = config?.settings ?? {};

  if (Object.keys(settings).length > 0) {
    const parsed = definition.settingsSchema.safeParse(settings);
    if (!parsed.success) {
      return {
        status: "error",
        reasons: parsed.error.issues.map((issue) => `${issue.path.join(".") || "settings"}: ${issue.message}`),
      };
    }
  }

  const reasons: string[] = [];
  const missingSettings = definition.settingFields
    .filter((field) => field.required && isBlank(settings[field.key]))
    .map((field) => field.label);
  const missingSecrets = definition.secrets
    .filter((secret) => secret.required && !secretsPresent[secret.env])
    .map((secret) => `${secret.label} (${secret.env})`);
  if (missingSettings.length > 0) reasons.push(`Missing settings: ${missingSettings.join(", ")}`);
  if (missingSecrets.length > 0) reasons.push(`Missing server secrets: ${missingSecrets.join(", ")}`);
  if (reasons.length > 0) return { status: "not_configured", reasons };

  const testedCurrentSettings = config?.testedSettingsHash === settingsHash(settings);
  if (config?.lastTestStatus === "failed" && testedCurrentSettings) {
    return { status: "error", reasons: [config.lastTestMessage ?? "The last connection test failed."] };
  }

  if (connectorAvailable && config?.enabled && config.lastTestStatus === "succeeded" && testedCurrentSettings) {
    return { status: "connected", reasons: [] };
  }

  if (!connectorAvailable) {
    reasons.push(
      `Connection testing arrives with the connector (planned for Phase ${definition.plannedPhase}); until a test succeeds it is never shown as connected.`,
    );
  } else if (!config?.enabled) {
    reasons.push("Enable the integration and run a connection test.");
  } else {
    reasons.push("Run a connection test to verify the settings.");
  }
  return { status: "ready_to_configure", reasons };
}
