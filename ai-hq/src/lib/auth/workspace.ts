import "server-only";

import { cache } from "react";
import { ApiError } from "@/lib/api/errors";
import { getProfile } from "@/lib/data/profiles";
import { getSystemSettings } from "@/lib/data/settings";
import type { Profile, SystemSettings, WorkspaceRole } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { requireUser, type AuthUser } from "./session";

export interface WorkspaceContext {
  user: AuthUser;
  supabase: AppSupabaseClient;
  profile: Profile;
  settings: SystemSettings;
}

export function isAdminRole(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

/** Signed-in user plus their workspace profile and the workspace settings. */
export const requireWorkspace = cache(async (): Promise<WorkspaceContext> => {
  const { user, supabase } = await requireUser();
  const [profile, settings] = await Promise.all([getProfile(supabase, user.id), getSystemSettings(supabase)]);
  return {
    user,
    supabase,
    // A profile is created by a database trigger; fall back to the least privilege if it is missing.
    profile: profile ?? { id: user.id, email: user.email, displayName: null, role: "member", createdAt: "" },
    settings,
  };
});

/** For API routes: resolves the caller's role and rejects non-admins with 403. */
export async function assertWorkspaceAdmin(supabase: AppSupabaseClient, userId: string): Promise<Profile> {
  const profile = await getProfile(supabase, userId);
  if (!profile || !isAdminRole(profile.role)) {
    throw new ApiError("FORBIDDEN", "Only workspace admins can do this.");
  }
  return profile;
}

export async function assertWorkspaceOwner(supabase: AppSupabaseClient, userId: string): Promise<Profile> {
  const profile = await getProfile(supabase, userId);
  if (profile?.role !== "owner") {
    throw new ApiError("FORBIDDEN", "Only the workspace owner can do this.");
  }
  return profile;
}
