import "server-only";

import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { CommandCenterSummary } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { toCommandCenterSummary } from "./mappers";

export async function getCommandCenterSummary(supabase: AppSupabaseClient): Promise<CommandCenterSummary> {
  const { data, error } = await supabase.rpc("command_center_summary");
  if (error) throw mapPostgrestError(error, "Summary");
  return toCommandCenterSummary(data);
}
