import { z } from "zod";

/**
 * Server-side configuration. Values are read from process.env at request time
 * and are never exposed to the browser (no NEXT_PUBLIC_ prefix).
 *
 * This module has no `server-only` import because proxy.ts uses it too; it
 * contains no secrets, only parsing logic.
 */

export const APP_ENVS = ["development", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export interface ServerEnv {
  appEnv: AppEnv;
  supabaseUrl: string;
  supabasePublishableKey: string;
  /** Lower-cased emails allowed to use AI HQ. Empty means any authenticated user (non-production only). */
  allowedEmails: string[];
}

export class ConfigurationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`AI HQ server configuration is invalid:\n- ${issues.join("\n- ")}`);
    this.name = "ConfigurationError";
    this.issues = issues;
  }
}

type EnvSource = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname);
}

function decodeJwtRole(token: string): string | undefined {
  const [, payload] = token.split(".");
  if (!payload) return undefined;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: unknown };
    return typeof json.role === "string" ? json.role : undefined;
  } catch {
    return undefined;
  }
}

/** True when the key grants elevated (RLS-bypassing) access and must never be used by the app. */
export function isElevatedSupabaseKey(key: string): boolean {
  return key.startsWith("sb_secret_") || decodeJwtRole(key) === "service_role";
}

export function parseAllowedEmails(raw: string | undefined): { emails: string[]; invalid: string[] } {
  const entries = (raw ?? "")
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const emailSchema = z.email();
  const invalid = entries.filter((entry) => !emailSchema.safeParse(entry).success);
  return { emails: [...new Set(entries.filter((entry) => !invalid.includes(entry)))], invalid };
}

export function parseServerEnv(source: EnvSource): ServerEnv {
  const issues: string[] = [];

  const rawAppEnv = source.APP_ENV?.trim();
  let appEnv: AppEnv | undefined;
  if (rawAppEnv) {
    const parsed = z.enum(APP_ENVS).safeParse(rawAppEnv);
    if (parsed.success) appEnv = parsed.data;
    else issues.push(`APP_ENV must be one of ${APP_ENVS.join(", ")}.`);
  } else if (source.NODE_ENV === "production") {
    issues.push("APP_ENV is required for production builds (development, staging or production).");
  } else {
    appEnv = "development";
  }

  const supabaseUrl = source.SUPABASE_URL?.trim() ?? "";
  if (!supabaseUrl) {
    issues.push("SUPABASE_URL is missing.");
  } else {
    let url: URL | undefined;
    try {
      url = new URL(supabaseUrl);
    } catch {
      issues.push("SUPABASE_URL is not a valid URL.");
    }
    if (url) {
      const local = isLocalHost(url.hostname);
      if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
        issues.push("SUPABASE_URL must use https (http is only allowed for a local Supabase).");
      }
      if (appEnv === "production" && local) {
        issues.push("SUPABASE_URL points at a local Supabase instance while APP_ENV=production.");
      }
    }
  }

  const supabasePublishableKey = source.SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  if (!supabasePublishableKey) {
    issues.push("SUPABASE_PUBLISHABLE_KEY is missing.");
  } else if (isElevatedSupabaseKey(supabasePublishableKey)) {
    issues.push(
      "SUPABASE_PUBLISHABLE_KEY contains a secret/service_role key. Use the publishable (anon) key; the app must stay subject to RLS.",
    );
  }

  const { emails, invalid } = parseAllowedEmails(source.AI_HQ_ALLOWED_EMAILS);
  if (invalid.length > 0) {
    issues.push(`AI_HQ_ALLOWED_EMAILS contains invalid entries: ${invalid.join(", ")}.`);
  }
  if (appEnv === "production" && emails.length === 0) {
    issues.push("AI_HQ_ALLOWED_EMAILS must list at least one email when APP_ENV=production.");
  }

  if (issues.length > 0 || !appEnv) {
    throw new ConfigurationError(issues);
  }

  return { appEnv, supabaseUrl, supabasePublishableKey, allowedEmails: emails };
}

let cachedEnv: ServerEnv | undefined;

/** Parsed server configuration. Throws ConfigurationError when it is incomplete. */
export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}

export type ServerEnvStatus = { ok: true; env: ServerEnv } | { ok: false; issues: string[] };

export function getServerEnvStatus(): ServerEnvStatus {
  try {
    return { ok: true, env: getServerEnv() };
  } catch (error) {
    if (error instanceof ConfigurationError) return { ok: false, issues: error.issues };
    throw error;
  }
}
