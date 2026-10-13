import { z } from "zod";
import type { IntegrationDefinition } from "./types";

/**
 * Catalogue of integrations AI HQ is prepared for. Definitions only: nothing
 * here connects to anything. Settings are non-secret; credentials are named by
 * their environment variable and never stored in the database.
 */

const httpsUrl = z
  .url({ message: "Enter a valid URL." })
  .refine((value) => new URL(value).protocol === "https:", { message: "Use an https:// URL." })
  .refine(
    (value) => {
      const url = new URL(value);
      return !url.username && !url.password && !url.search && !url.hash;
    },
    { message: "The URL must not contain credentials, query strings or fragments." },
  );

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    key: "n8n",
    name: "n8n Cloud",
    category: "automation",
    description:
      "Your existing n8n Cloud workflows. AI HQ will list and trigger them; it never creates or edits workflows.",
    plannedUse: [
      "Link Automation Center entries to existing workflows",
      "Trigger linked workflows with idempotency keys",
      "Record executions in Activity Logs",
    ],
    plannedPhase: 3,
    settingsSchema: z.strictObject({
      baseUrl: httpsUrl,
      requestTimeoutSeconds: z.number().int().min(1).max(120).optional(),
    }),
    settingFields: [
      {
        key: "baseUrl",
        label: "Instance URL",
        type: "url",
        required: true,
        placeholder: "https://<your-instance>.app.n8n.cloud",
        help: "The address of your n8n instance. Not secret; the API key stays in the server environment.",
      },
      { key: "requestTimeoutSeconds", label: "Request timeout (seconds)", type: "number", required: false },
    ],
    secrets: [
      { env: "N8N_API_KEY", label: "n8n API key", required: true },
      { env: "N8N_WEBHOOK_SIGNING_SECRET", label: "Webhook signing secret (for callbacks)", required: false },
    ],
  },
  {
    key: "anthropic",
    name: "Anthropic Claude",
    category: "ai",
    description: "Model provider for AI Agent Hub agents.",
    plannedUse: ["Run agent tasks on the server", "Track token usage and cost per task"],
    plannedPhase: 4,
    settingsSchema: z.strictObject({
      defaultModel: optionalText(100),
      monthlyBudgetUsd: z.number().min(0).max(100_000).optional(),
    }),
    settingFields: [
      {
        key: "defaultModel",
        label: "Default model id",
        type: "text",
        required: false,
        help: "Used when an agent does not name a model.",
      },
      { key: "monthlyBudgetUsd", label: "Monthly budget (USD)", type: "number", required: false },
    ],
    secrets: [{ env: "ANTHROPIC_API_KEY", label: "Anthropic API key", required: true }],
  },
  {
    key: "openai",
    name: "OpenAI",
    category: "ai",
    description: "Alternative model provider for AI Agent Hub agents.",
    plannedUse: ["Run agent tasks on the server", "Track token usage and cost per task"],
    plannedPhase: 4,
    settingsSchema: z.strictObject({
      defaultModel: optionalText(100),
      monthlyBudgetUsd: z.number().min(0).max(100_000).optional(),
    }),
    settingFields: [
      { key: "defaultModel", label: "Default model id", type: "text", required: false },
      { key: "monthlyBudgetUsd", label: "Monthly budget (USD)", type: "number", required: false },
    ],
    secrets: [{ env: "OPENAI_API_KEY", label: "OpenAI API key", required: true }],
  },
  {
    key: "webhooks",
    name: "Signed webhooks",
    category: "automation",
    description: "Inbound HTTP callbacks (for example execution results) verified with an HMAC signature.",
    plannedUse: ["Receive results from external automations", "Reject unsigned or replayed requests"],
    plannedPhase: 3,
    settingsSchema: z.strictObject({
      maxAgeSeconds: z.number().int().min(30).max(3_600).optional(),
    }),
    settingFields: [
      {
        key: "maxAgeSeconds",
        label: "Maximum signature age (seconds)",
        type: "number",
        required: false,
        help: "Older requests are rejected to prevent replays.",
      },
    ],
    secrets: [{ env: "WEBHOOK_SIGNING_SECRET", label: "Webhook signing secret", required: true }],
  },
  {
    key: "google_play",
    name: "Google Play Console",
    category: "games",
    description: "Release tracks, reviews and store listing status for Android games.",
    plannedUse: ["Show release status in Game Studio", "Import store reviews as tasks"],
    plannedPhase: 5,
    settingsSchema: z.strictObject({
      packageNames: z
        .array(
          z
            .string()
            .trim()
            .regex(/^[a-zA-Z]\w*(\.[a-zA-Z]\w*)+$/, { message: "Use a package name such as com.studio.game." }),
        )
        .max(20)
        .optional(),
    }),
    settingFields: [
      {
        key: "packageNames",
        label: "Package names",
        type: "list",
        required: false,
        placeholder: "com.studio.game",
        help: "One per line.",
      },
    ],
    secrets: [{ env: "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", label: "Service account (JSON, base64)", required: true }],
  },
  {
    key: "app_store_connect",
    name: "App Store Connect",
    category: "games",
    description: "Builds, review status and store listings for iOS games.",
    plannedUse: ["Show build and review status in Game Studio"],
    plannedPhase: 5,
    settingsSchema: z.strictObject({
      issuerId: z.uuid({ message: "The issuer id is a UUID." }).optional(),
      keyId: z
        .string()
        .trim()
        .regex(/^[A-Z0-9]{8,12}$/, { message: "Use the key id shown in App Store Connect." })
        .optional(),
    }),
    settingFields: [
      { key: "issuerId", label: "Issuer id", type: "text", required: false },
      { key: "keyId", label: "Key id", type: "text", required: false },
    ],
    secrets: [{ env: "APP_STORE_CONNECT_PRIVATE_KEY", label: "API private key (.p8, base64)", required: true }],
  },
  {
    key: "stripe",
    name: "Stripe",
    category: "business",
    description: "Read-only revenue data for SaaS & Business.",
    plannedUse: ["MRR, churn and revenue figures", "Customer overview"],
    plannedPhase: 6,
    settingsSchema: z.strictObject({
      mode: z.enum(["test", "live"]),
    }),
    settingFields: [
      {
        key: "mode",
        label: "Mode",
        type: "select",
        required: true,
        options: [
          { value: "test", label: "Test" },
          { value: "live", label: "Live" },
        ],
      },
    ],
    secrets: [{ env: "STRIPE_RESTRICTED_KEY", label: "Restricted read-only key", required: true }],
  },
];

const BY_KEY = new Map(INTEGRATIONS.map((definition) => [definition.key, definition]));

export function getIntegrationDefinition(key: string): IntegrationDefinition | undefined {
  return BY_KEY.get(key);
}

export function integrationsByCategory(category: IntegrationDefinition["category"]): IntegrationDefinition[] {
  return INTEGRATIONS.filter((definition) => definition.category === category);
}
