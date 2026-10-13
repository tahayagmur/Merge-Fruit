import { apiRoute, jsonData, parseWith } from "@/lib/api/route";
import { listActivity } from "@/lib/data/activity";
import { activityQuerySchema } from "@/lib/validation/activity";

export const GET = apiRoute(async ({ request, supabase }) => {
  const query = parseWith(activityQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
  return jsonData(await listActivity(supabase, query));
});
