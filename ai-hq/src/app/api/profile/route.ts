import { ApiError } from "@/lib/api/errors";
import { apiRoute, jsonData, readJson } from "@/lib/api/route";
import { getProfile, updateDisplayName } from "@/lib/data/profiles";
import { profileUpdateSchema } from "@/lib/validation/settings";

export const GET = apiRoute(async ({ supabase, user }) => {
  const profile = await getProfile(supabase, user.id);
  if (!profile) throw ApiError.notFound("Profile");
  return jsonData(profile);
});

export const PATCH = apiRoute(async ({ request, supabase, user }) => {
  const input = await readJson(request, profileUpdateSchema);
  return jsonData(await updateDisplayName(supabase, user.id, input.displayName));
});
