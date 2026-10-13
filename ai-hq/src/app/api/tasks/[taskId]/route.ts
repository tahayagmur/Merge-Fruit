import { apiRoute, jsonData, noContent, parseWith, readJson } from "@/lib/api/route";
import { deleteTask, updateTask } from "@/lib/data/tasks";
import { idSchema } from "@/lib/validation/common";
import { taskUpdateSchema } from "@/lib/validation/tasks";

type Params = { taskId: string };

export const PATCH = apiRoute<Params>(async ({ request, params, supabase }) => {
  const id = parseWith(idSchema, params.taskId, "Invalid task id.");
  const input = await readJson(request, taskUpdateSchema);
  return jsonData(await updateTask(supabase, id, input));
});

export const DELETE = apiRoute<Params>(async ({ params, supabase }) => {
  const id = parseWith(idSchema, params.taskId, "Invalid task id.");
  await deleteTask(supabase, id);
  return noContent();
});
