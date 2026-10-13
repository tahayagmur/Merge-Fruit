import type { z } from "zod";

/**
 * Contracts for external integrations.
 *
 * Every integration is described by an IntegrationDefinition in registry.ts.
 * Adding a service later means adding one definition (and, when it is time to
 * connect, one connector) — nothing else in the app has to change.
 *
 * Phase 2 ships NO connectors: no integration talks to an external system.
 */

export const INTEGRATION_CATEGORIES = ["automation", "ai", "games", "business"] as const;
export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

export const INTEGRATION_CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  automation: "Automation",
  ai: "AI models",
  games: "Game platforms",
  business: "Business data",
};

export const INTEGRATION_STATUSES = ["not_configured", "ready_to_configure", "connected", "error"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export interface SettingField {
  key: string;
  label: string;
  type: "text" | "url" | "number" | "select" | "list";
  required: boolean;
  placeholder?: string;
  help?: string;
  options?: Array<{ value: string; label: string }>;
}

/** A credential the integration needs. Only its environment variable NAME is known to the app. */
export interface SecretRequirement {
  env: string;
  label: string;
  required: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  /** Short, user-safe message. Never include secrets or raw upstream errors. */
  message: string;
}

/** Implemented per integration when it is actually connected (not in Phase 2). */
export interface IntegrationConnector {
  testConnection(settings: Record<string, unknown>): Promise<ConnectionTestResult>;
}

export interface IntegrationDefinition {
  key: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  /** What AI HQ will use the integration for once it is connected. */
  plannedUse: string[];
  /** Phase in which the connector is planned. */
  plannedPhase: number;
  settingsSchema: z.ZodType<Record<string, unknown>>;
  settingFields: SettingField[];
  secrets: SecretRequirement[];
}

/** Stored, non-secret configuration (integration_configs row). */
export interface IntegrationConfigRecord {
  key: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  lastTestStatus: "succeeded" | "failed" | null;
  lastTestMessage: string | null;
  lastTestedAt: string | null;
  testedSettingsHash: string | null;
  updatedAt: string | null;
}

/** Everything the UI needs to show an integration. Contains no secret values. */
export interface IntegrationView {
  key: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  plannedUse: string[];
  plannedPhase: number;
  settingFields: SettingField[];
  enabled: boolean;
  settings: Record<string, unknown>;
  secrets: Array<SecretRequirement & { present: boolean }>;
  status: IntegrationStatus;
  statusReasons: string[];
  connectorAvailable: boolean;
  lastTestedAt: string | null;
  updatedAt: string | null;
}
