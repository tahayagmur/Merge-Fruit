import { ApiError } from "@/lib/api/errors";
import { apiRoute, jsonData, noContent, parseWith, readJson } from "@/lib/api/route";
import { deleteProject, getProject, updateProject } from "@/lib/data/projects";
import { idSchema } from "@/lib/validation/common";
import { projectUpdateSchema } from "@/lib/validation/projects";

type Params = { projectId: string };

export const GET = apiRoute<Params>(async ({ params, supabase }) => {
  const id = parseWith(idSchema, params.projectId, "Invalid project id.");
  const project = await getProject(supabase, id);
  if (!project) throw ApiError.notFound("Project");
  return jsonData(project);
});

export const PATCH = apiRoute<Params>(async ({ request, params, supabase }) => {
  const id = parseWith(idSchema, params.projectId, "Invalid project id.");
  const input = await readJson(request, projectUpdateSchema);
  return jsonData(await updateProject(supabase, id, input));
});

export const DELETE = apiRoute<Params>(async ({ params, supabase }) => {
  const id = parseWith(idSchema, params.projectId, "Invalid project id.");
  await deleteProject(supabase, id);
  return noContent();
});
