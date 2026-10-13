import "server-only";

import type { IntegrationConnector } from "./types";

/**
 * Connector lookup. Phase 2 deliberately ships no connectors, so every
 * integration reports "connector not available" and nothing contacts an
 * external system. A later phase registers connectors here, e.g.
 *   n8n: createN8nConnector(),
 */
const CONNECTORS: Partial<Record<string, IntegrationConnector>> = {};

export function getConnector(key: string): IntegrationConnector | null {
  return CONNECTORS[key] ?? null;
}
