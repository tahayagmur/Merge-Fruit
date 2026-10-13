import "server-only";

import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { SystemSettings } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import type { SystemSettingsUpdateInput } from "@/lib/validation/settings";
import { toSystemSettings } from "./mappers";

const DEFAULT_SETTINGS: SystemSettings = { workspaceName: "AI HQ", timezone: "UTC", updatedAt: new Date(0).toISOString() };

export async function getSystemSettings(supabase: AppSupabaseClient): Promise<SystemSettings> {
  const { data, error } = await supabase.from("system_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw mapPostgrestError(error, "Settings");
  return data ? toSystemSettings(data) : DEFAULT_SETTINGS;
}

/**
 * RLS lets only admins update the row; callers check the role first to return
 * a clear 403 instead of a silent no-op.
 */
export async function updateSystemSettings(
  supabase: AppSupabaseClient,
  input: SystemSettingsUpdateInput,
): Promise<SystemSettings> {
  const { data, error } = await supabase
    .from("system_settings")
    .update({ workspace_name: input.workspaceName, timezone: input.timezone })
    .eq("id", true)
    .select("*")
    .single();
  if (error) throw mapPostgrestError(error, "Settings");
  return toSystemSettings(data);
}
