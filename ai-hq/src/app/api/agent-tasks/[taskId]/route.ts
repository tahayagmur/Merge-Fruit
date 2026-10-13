import { apiRoute, jsonData, noContent, parseWith, readJson } from "@/lib/api/route";
import { deleteAgentTask, updateAgentTask } from "@/lib/data/agents";
import { agentTaskUpdateSchema } from "@/lib/validation/agents";
import { idSchema } from "@/lib/validation/common";

type Params = { taskId: string };

/** Edit a queued task or cancel it. Results can only be recorded by an agent runtime. */
export const PATCH = apiRoute<Params>(async ({ request, params, supabase }) => {
  const id = parseWith(idSchema, params.taskId, "Invalid task id.");
  const input = await readJson(request, agentTaskUpdateSchema);
  return jsonData(await updateAgentTask(supabase, id, input));
});

export const DELETE = apiRoute<Params>(async ({ params, supabase }) => {
  const id = parseWith(idSchema, params.taskId, "Invalid task id.");
  await deleteAgentTask(supabase, id);
  return noContent();
});
