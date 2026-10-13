import { apiRoute, jsonData, parseWith, readJson } from "@/lib/api/route";
import { createProject, listProjects } from "@/lib/data/projects";
import { projectCreateSchema, projectListQuerySchema } from "@/lib/validation/projects";

export const GET = apiRoute(async ({ request, supabase }) => {
  const filters = parseWith(projectListQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
  return jsonData(await listProjects(supabase, filters));
});

export const POST = apiRoute(async ({ request, supabase, user }) => {
  const input = await readJson(request, projectCreateSchema);
  return jsonData(await createProject(supabase, user.id, input), 201);
});
