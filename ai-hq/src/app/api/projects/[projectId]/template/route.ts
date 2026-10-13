import { ApiError } from "@/lib/api/errors";
import { apiRoute, jsonData, parseWith, readJson } from "@/lib/api/route";
import { getProject } from "@/lib/data/projects";
import { applyProjectTemplate } from "@/lib/data/tasks";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import { idSchema } from "@/lib/validation/common";
import { applyTemplateSchema } from "@/lib/validation/projects";

type Params = { projectId: string };

/** Adds a built-in checklist's tasks to the project (idempotent). */
export const POST = apiRoute<Params>(async ({ request, params, supabase, user }) => {
  const projectId = parseWith(idSchema, params.projectId, "Invalid project id.");
  const input = await readJson(request, applyTemplateSchema);
  if (!(await getProject(supabase, projectId))) throw ApiError.notFound("Project");
  return jsonData(await applyProjectTemplate(supabase, user.id, projectId, PROJECT_TEMPLATES[input.template]), 201);
});
