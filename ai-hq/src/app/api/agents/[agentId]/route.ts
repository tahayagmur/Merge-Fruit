import { ApiError } from "@/lib/api/errors";
import { apiRoute, jsonData, noContent, parseWith, readJson } from "@/lib/api/route";
import { deleteAgent, getAgent, updateAgent } from "@/lib/data/agents";
import { agentUpdateSchema } from "@/lib/validation/agents";
import { idSchema } from "@/lib/validation/common";

type Params = { agentId: string };

export const GET = apiRoute<Params>(async ({ params, supabase }) => {
  const id = parseWith(idSchema, params.agentId, "Invalid agent id.");
  const agent = await getAgent(supabase, id);
  if (!agent) throw ApiError.notFound("Agent");
  return jsonData(agent);
});

export const PATCH = apiRoute<Params>(async ({ request, params, supabase }) => {
  const id = parseWith(idSchema, params.agentId, "Invalid agent id.");
  const input = await readJson(request, agentUpdateSchema);
  return jsonData(await updateAgent(supabase, id, input));
});

export const DELETE = apiRoute<Params>(async ({ params, supabase }) => {
  const id = parseWith(idSchema, params.agentId, "Invalid agent id.");
  await deleteAgent(supabase, id);
  return noContent();
});
