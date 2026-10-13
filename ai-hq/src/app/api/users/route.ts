import { apiRoute, jsonData } from "@/lib/api/route";
import { assertWorkspaceAdmin } from "@/lib/auth/workspace";
import { listProfiles } from "@/lib/data/profiles";

export const GET = apiRoute(async ({ supabase, user }) => {
  await assertWorkspaceAdmin(supabase, user.id);
  return jsonData(await listProfiles(supabase));
});
