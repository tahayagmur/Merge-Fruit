import { apiRoute, jsonData, parseWith, readJson } from "@/lib/api/route";
import { createAgent, listAgents } from "@/lib/data/agents";
import { agentCreateSchema, agentListQuerySchema } from "@/lib/validation/agents";

export const GET = apiRoute(async ({ request, supabase }) => {
  const query = parseWith(agentListQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
  return jsonData(await listAgents(supabase, query));
});

export const POST = apiRoute(async ({ request, supabase, user }) => {
  const input = await readJson(request, agentCreateSchema);
  return jsonData(await createAgent(supabase, user.id, input), 201);
});
