import { apiRoute, jsonData, readJson } from "@/lib/api/route";
import { assertWorkspaceAdmin } from "@/lib/auth/workspace";
import { getSystemSettings, updateSystemSettings } from "@/lib/data/settings";
import { systemSettingsUpdateSchema } from "@/lib/validation/settings";

export const GET = apiRoute(async ({ supabase }) => jsonData(await getSystemSettings(supabase)));

export const PATCH = apiRoute(async ({ request, supabase, user }) => {
  await assertWorkspaceAdmin(supabase, user.id);
  const input = await readJson(request, systemSettingsUpdateSchema);
  return jsonData(await updateSystemSettings(supabase, input));
});
