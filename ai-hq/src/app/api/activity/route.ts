import { apiRoute, jsonData, parseWith } from "@/lib/api/route";
import { assertWorkspaceAdmin } from "@/lib/auth/workspace";
import { listActivity } from "@/lib/data/activity";
import { activityQuerySchema } from "@/lib/validation/activity";

/** `?scope=workspace` returns every user's entries and is limited to owners and admins. */
export const GET = apiRoute(async ({ request, supabase, user }) => {
  const query = parseWith(activityQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
  if (query.scope === "workspace") {
    await assertWorkspaceAdmin(supabase, user.id);
    return jsonData(await listActivity(supabase, query, { workspace: true }));
  }
  return jsonData(await listActivity(supabase, query, { ownerId: user.id }));
});
