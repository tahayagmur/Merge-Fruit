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

/**
 * True for hosts that are only reachable inside a private network: loopback,
 * RFC 1918 and CGNAT/Tailscale (100.64/10) addresses, single-label names such
 * as Docker service names, and private DNS suffixes.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1") return true;
  if (!host.includes(".") && !host.includes(":")) return true;
  if (/\.(local|internal|lan|home\.arpa|ts\.net)$/.test(host)) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** https anywhere; plain http only inside a private network (localhost, LAN, Tailscale, Docker). */
const privateOrHttpsUrl = z
  .url({ message: "Enter a valid URL." })
  .refine(
    (value) => {
      const url = new URL(value);
      return url.protocol === "https:" || (url.protocol === "http:" && isPrivateHost(url.hostname));
    },
    { message: "Use https://, or http:// only for localhost or a private network address." },
  )
  .refine(
    (value) => {
      const url = new URL(value);
      return !url.username && !url.password && !url.search && !url.hash;
    },
    { message: "The URL must not contain credentials, query strings or fragments." },
  );

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
    key: "hermes",
    name: "Hermes Agent",
    category: "ai",
    description:
      "Self-hosted agent runtime by Nous Research. Runs AI Agent Hub tasks with the model configured inside Hermes (for example Gemini); that model key stays in Hermes.",
    plannedUse: [
      "Submit queued tasks of Ready agents as Hermes runs (idempotency key = task id)",
      "Track run status, output and token usage on each task",
      "Stop the Hermes run when a task is cancelled",
    ],
    plannedPhase: 4,
    settingsSchema: z.strictObject({
      baseUrl: privateOrHttpsUrl,
      defaultProvider: z
        .string()
        .trim()
        .regex(/^[a-z][a-z0-9:_-]{1,40}$/, { message: "Use a Hermes provider name such as gemini." })
        .optional(),
      defaultModel: optionalText(100),
      requestTimeoutSeconds: z.number().int().min(1).max(120).optional(),
    }),
    settingFields: [
      {
        key: "baseUrl",
        label: "API server URL",
        type: "url",
        required: true,
        placeholder: "http://127.0.0.1:8642",
        help: "Hermes API server (API_SERVER_ENABLED=true). Plain http only on localhost or a private network; never expose its port to the internet.",
      },
      {
        key: "defaultProvider",
        label: "Model provider in Hermes",
        type: "text",
        required: false,
        placeholder: "gemini",
        help: "Hermes provider name used for runs. Empty = Hermes' own default.",
      },
      {
        key: "defaultModel",
        label: "Default model id",
        type: "text",
        required: false,
        help: "As listed by `hermes model`. Used when an agent does not name a model.",
      },
      { key: "requestTimeoutSeconds", label: "Request timeout (seconds)", type: "number", required: false },
    ],
    secrets: [{ env: "HERMES_API_KEY", label: "Hermes API server key (API_SERVER_KEY in Hermes)", required: true }],
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
