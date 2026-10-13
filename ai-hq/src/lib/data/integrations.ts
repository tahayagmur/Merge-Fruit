import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { Json } from "@/lib/database.types";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import type { IntegrationConfigRecord, IntegrationView } from "@/lib/integrations/types";
import { buildIntegrationView, buildIntegrationViews } from "@/lib/integrations/views";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { toIntegrationConfig } from "./mappers";

export async function listIntegrationConfigs(supabase: AppSupabaseClient): Promise<IntegrationConfigRecord[]> {
  const { data, error } = await supabase.from("integration_configs").select("*").order("key");
  if (error) throw mapPostgrestError(error, "Integration");
  return data.map(toIntegrationConfig);
}

export async function listIntegrationViews(supabase: AppSupabaseClient): Promise<IntegrationView[]> {
  return buildIntegrationViews(await listIntegrationConfigs(supabase));
}

export async function getIntegrationView(supabase: AppSupabaseClient, key: string): Promise<IntegrationView> {
  const definition = getIntegrationDefinition(key);
  if (!definition) throw ApiError.notFound("Integration");
  const { data, error } = await supabase.from("integration_configs").select("*").eq("key", key).maybeSingle();
  if (error) throw mapPostgrestError(error, "Integration");
  return buildIntegrationView(definition, data ? toIntegrationConfig(data) : null);
}

/**
 * Saves non-secret settings after validating them against the integration's
 * own schema. Never stores credentials: the schemas have no secret fields and
 * reject unknown keys.
 */
export async function saveIntegrationConfig(
  supabase: AppSupabaseClient,
  key: string,
  input: { enabled?: boolean; settings?: Record<string, unknown> },
): Promise<IntegrationView> {
  const definition = getIntegrationDefinition(key);
  if (!definition) throw ApiError.notFound("Integration");

  let settings: Record<string, unknown> | undefined;
  if (input.settings !== undefined) {
    const parsed = definition.settingsSchema.safeParse(input.settings);
    if (!parsed.success) throw ApiError.fromZod(parsed.error, "Some settings are invalid.");
    // Drop empty optional values so the stored object stays minimal.
    settings = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined));
  }

  const { data: existing, error: readError } = await supabase
    .from("integration_configs")
    .select("key")
    .eq("key", key)
    .maybeSingle();
  if (readError) throw mapPostgrestError(readError, "Integration");

  const result = existing
    ? await supabase
        .from("integration_configs")
        .update({
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(settings !== undefined ? { settings: settings as NonNullable<Json> } : {}),
        })
        .eq("key", key)
        .select("*")
        .maybeSingle()
    : await supabase
        .from("integration_configs")
        .insert({ key, enabled: input.enabled ?? false, settings: (settings ?? {}) as NonNullable<Json> })
        .select("*")
        .maybeSingle();

  if (result.error) throw mapPostgrestError(result.error, "Integration");
  if (!result.data) throw new ApiError("FORBIDDEN", "Only workspace admins can change integrations.");
  return buildIntegrationView(definition, toIntegrationConfig(result.data));
}

export async function resetIntegrationConfig(supabase: AppSupabaseClient, key: string): Promise<IntegrationView> {
  const definition = getIntegrationDefinition(key);
  if (!definition) throw ApiError.notFound("Integration");
  const { error } = await supabase.from("integration_configs").delete().eq("key", key);
  if (error) throw mapPostgrestError(error, "Integration");
  return buildIntegrationView(definition, null);
}
