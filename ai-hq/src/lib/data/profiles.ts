import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { Profile, WorkspaceRole } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { toProfile } from "./mappers";

const PROFILE_COLUMNS = "id, email, display_name, role, created_at";

export async function getProfile(supabase: AppSupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  if (error) throw mapPostgrestError(error, "Profile");
  return data ? toProfile(data) : null;
}

/** Admins see every profile (RLS); members only receive their own row. */
export async function listProfiles(supabase: AppSupabaseClient): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).order("created_at").limit(500);
  if (error) throw mapPostgrestError(error, "Profile");
  return data.map(toProfile);
}

export async function updateDisplayName(
  supabase: AppSupabaseClient,
  userId: string,
  displayName: string | null,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();
  if (error) throw mapPostgrestError(error, "Profile");
  if (!data) throw ApiError.notFound("Profile");
  return toProfile(data);
}

export async function setWorkspaceRole(
  supabase: AppSupabaseClient,
  targetUserId: string,
  role: WorkspaceRole,
): Promise<Profile> {
  const { data, error } = await supabase.rpc("set_workspace_role", { target_user: targetUserId, new_role: role });
  if (error) throw mapPostgrestError(error, "User");
  return toProfile(data);
}
