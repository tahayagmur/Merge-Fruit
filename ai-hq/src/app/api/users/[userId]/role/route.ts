import { apiRoute, jsonData, parseWith, readJson } from "@/lib/api/route";
import { assertWorkspaceOwner } from "@/lib/auth/workspace";
import { setWorkspaceRole } from "@/lib/data/profiles";
import { idSchema } from "@/lib/validation/common";
import { roleUpdateSchema } from "@/lib/validation/settings";

type Params = { userId: string };

/** Owner only. The database function enforces the same rule and keeps at least one owner. */
export const PATCH = apiRoute<Params>(async ({ request, params, supabase, user }) => {
  const targetId = parseWith(idSchema, params.userId, "Invalid user id.");
  await assertWorkspaceOwner(supabase, user.id);
  const input = await readJson(request, roleUpdateSchema);
  return jsonData(await setWorkspaceRole(supabase, targetId, input.role));
});
