import { ApiError } from "@/lib/api/errors";
import { apiRoute, jsonData, parseWith, readJson } from "@/lib/api/route";
import { getProject } from "@/lib/data/projects";
import { createTask, listTasks } from "@/lib/data/tasks";
import { idSchema } from "@/lib/validation/common";
import { taskCreateSchema } from "@/lib/validation/tasks";

type Params = { projectId: string };

export const GET = apiRoute<Params>(async ({ params, supabase }) => {
  const projectId = parseWith(idSchema, params.projectId, "Invalid project id.");
  if (!(await getProject(supabase, projectId))) throw ApiError.notFound("Project");
  return jsonData(await listTasks(supabase, projectId));
});

export const POST = apiRoute<Params>(async ({ request, params, supabase, user }) => {
  const projectId = parseWith(idSchema, params.projectId, "Invalid project id.");
  const input = await readJson(request, taskCreateSchema);
  return jsonData(await createTask(supabase, user.id, projectId, input), 201);
});
