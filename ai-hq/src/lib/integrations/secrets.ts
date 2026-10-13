import "server-only";

import type { IntegrationDefinition } from "./types";

/**
 * Reports whether each required environment variable is set. Values are only
 * presence-checked and never leave this function.
 */
export function secretPresence(
  definition: IntegrationDefinition,
  source: Record<string, string | undefined> = process.env,
): Record<string, boolean> {
  return Object.fromEntries(definition.secrets.map((secret) => [secret.env, Boolean(source[secret.env]?.trim())]));
}
