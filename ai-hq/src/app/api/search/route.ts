import { apiRoute, jsonData, parseWith } from "@/lib/api/route";
import { globalSearch } from "@/lib/data/search";
import { searchQuerySchema } from "@/lib/validation/common";

export const GET = apiRoute(async ({ request, supabase }) => {
  const term = parseWith(searchQuerySchema, request.nextUrl.searchParams.get("q") ?? undefined);
  if (!term) return jsonData({ query: "", projects: [], tasks: [], automations: [], agents: [] });
  return jsonData(await globalSearch(supabase, term));
});
