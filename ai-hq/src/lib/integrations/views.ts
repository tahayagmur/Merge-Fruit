import "server-only";

import { getConnector } from "./connectors";
import { INTEGRATIONS } from "./registry";
import { secretPresence } from "./secrets";
import { computeIntegrationStatus } from "./status";
import type { IntegrationConfigRecord, IntegrationDefinition, IntegrationView } from "./types";

/** Combines a definition, its stored configuration and the environment into a client-safe view. */
export function buildIntegrationView(
  definition: IntegrationDefinition,
  config: IntegrationConfigRecord | null,
  env: Record<string, string | undefined> = process.env,
): IntegrationView {
  const present = secretPresence(definition, env);
  const connectorAvailable = getConnector(definition.key) !== null;
  const { status, reasons } = computeIntegrationStatus({ definition, config, secretsPresent: present, connectorAvailable });
  return {
    key: definition.key,
    name: definition.name,
    category: definition.category,
    description: definition.description,
    plannedUse: definition.plannedUse,
    plannedPhase: definition.plannedPhase,
    settingFields: definition.settingFields,
    enabled: config?.enabled ?? false,
    settings: config?.settings ?? {},
    secrets: definition.secrets.map((secret) => ({ ...secret, present: present[secret.env] })),
    status,
    statusReasons: reasons,
    connectorAvailable,
    lastTestedAt: config?.lastTestedAt ?? null,
    updatedAt: config?.updatedAt ?? null,
  };
}

export function buildIntegrationViews(
  configs: IntegrationConfigRecord[],
  env: Record<string, string | undefined> = process.env,
): IntegrationView[] {
  const byKey = new Map(configs.map((config) => [config.key, config]));
  return INTEGRATIONS.map((definition) => buildIntegrationView(definition, byKey.get(definition.key) ?? null, env));
}
