import { z } from "zod";

/**
 * n8n configuration contract for Phase 2.
 *
 * Phase 1 does not connect to n8n. These variables are only validated so the
 * UI can say whether the server is prepared; their values never leave the
 * server and are never logged.
 */

export interface N8nConfig {
  baseUrl: URL;
  apiKey: string;
  webhookSigningSecret: string | null;
}

export type N8nConfigState =
  | { state: "not_configured" }
  | { state: "invalid"; issues: string[] }
  | { state: "valid"; config: N8nConfig };

type EnvSource = Record<string, string | undefined>;

const baseUrlSchema = z
  .url({ message: "N8N_BASE_URL must be a valid URL." })
  .refine((value) => new URL(value).protocol === "https:", { message: "N8N_BASE_URL must use https." })
  .refine(
    (value) => {
      const url = new URL(value);
      return !url.username && !url.password && !url.search && !url.hash;
    },
    { message: "N8N_BASE_URL must not contain credentials, query strings or fragments." },
  );

const secretSchema = (name: string, min: number) =>
  z
    .string()
    .min(min, { message: `${name} looks too short.` })
    .regex(/^\S+$/, { message: `${name} must not contain whitespace.` });

export function parseN8nConfig(source: EnvSource): N8nConfigState {
  const baseUrl = source.N8N_BASE_URL?.trim();
  const apiKey = source.N8N_API_KEY?.trim();
  const signingSecret = source.N8N_WEBHOOK_SIGNING_SECRET?.trim();

  if (!baseUrl && !apiKey && !signingSecret) return { state: "not_configured" };

  const issues: string[] = [];
  if (!baseUrl) issues.push("N8N_BASE_URL is missing.");
  if (!apiKey) issues.push("N8N_API_KEY is missing.");

  const parsedUrl = baseUrl ? baseUrlSchema.safeParse(baseUrl) : undefined;
  if (parsedUrl && !parsedUrl.success) issues.push(...parsedUrl.error.issues.map((issue) => issue.message));

  const parsedKey = apiKey ? secretSchema("N8N_API_KEY", 16).safeParse(apiKey) : undefined;
  if (parsedKey && !parsedKey.success) issues.push(...parsedKey.error.issues.map((issue) => issue.message));

  const parsedSecret = signingSecret
    ? secretSchema("N8N_WEBHOOK_SIGNING_SECRET", 32).safeParse(signingSecret)
    : undefined;
  if (parsedSecret && !parsedSecret.success) {
    issues.push(...parsedSecret.error.issues.map((issue) => issue.message));
  }

  if (issues.length > 0 || !baseUrl || !apiKey) return { state: "invalid", issues };

  return {
    state: "valid",
    config: { baseUrl: new URL(baseUrl), apiKey, webhookSigningSecret: signingSecret ?? null },
  };
}
