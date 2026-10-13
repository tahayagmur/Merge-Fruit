import { ApiError } from "@/lib/api/errors";
import { apiRoute, jsonData, parseWith, readJson } from "@/lib/api/route";
import { createAgentTask, getAgent, listAgentTasks } from "@/lib/data/agents";
import { agentTaskCreateSchema } from "@/lib/validation/agents";
import { idSchema } from "@/lib/validation/common";

type Params = { agentId: string };

export const GET = apiRoute<Params>(async ({ params, supabase }) => {
  const agentId = parseWith(idSchema, params.agentId, "Invalid agent id.");
  if (!(await getAgent(supabase, agentId))) throw ApiError.notFound("Agent");
  return jsonData(await listAgentTasks(supabase, agentId));
});

/** Queues a task. Nothing executes it in this phase: there is no agent runtime yet. */
export const POST = apiRoute<Params>(async ({ request, params, supabase, user }) => {
  const agentId = parseWith(idSchema, params.agentId, "Invalid agent id.");
  const input = await readJson(request, agentTaskCreateSchema);
  return jsonData(await createAgentTask(supabase, user.id, agentId, input), 201);
});
