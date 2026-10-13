import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { Page, Project, ProjectSummary } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import type { ProjectCreateInput, ProjectListQuery, ProjectUpdateInput } from "@/lib/validation/projects";
import { toProject, toProjectSummary } from "./mappers";
import { pageRange, searchFilter, toPage } from "./query-helpers";

export const PROJECTS_PAGE_SIZE = 12;

export async function listProjects(
  supabase: AppSupabaseClient,
  filters: Partial<ProjectListQuery> & { pageSize?: number; includeDemo?: boolean } = {},
): Promise<Page<ProjectSummary>> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PROJECTS_PAGE_SIZE;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase
    .from("project_overview")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.includeDemo === false) query = query.eq("is_demo", false);
  if (filters.q) query = query.or(searchFilter(["name", "description"], filters.q));

  const { data, error, count } = await query;
  if (error) throw mapPostgrestError(error, "Project");
  return toPage(data.map(toProjectSummary), count, page, pageSize);
}

export async function getProject(supabase: AppSupabaseClient, id: string): Promise<ProjectSummary | null> {
  const { data, error } = await supabase.from("project_overview").select("*").eq("id", id).maybeSingle();
  if (error) throw mapPostgrestError(error, "Project");
  return data ? toProjectSummary(data) : null;
}

export async function createProject(
  supabase: AppSupabaseClient,
  ownerId: string,
  input: ProjectCreateInput,
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: ownerId,
      name: input.name,
      description: input.description,
      status: input.status,
      category: input.category,
      priority: input.priority,
      due_date: input.dueDate,
    })
    .select()
    .single();
  if (error) throw mapPostgrestError(error, "Project");
  return toProject(data);
}

export async function updateProject(
  supabase: AppSupabaseClient,
  id: string,
  input: ProjectUpdateInput,
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update({
      name: input.name,
      description: input.description,
      status: input.status,
      category: input.category,
      priority: input.priority,
      due_date: input.dueDate,
    })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw mapPostgrestError(error, "Project");
  if (!data) throw ApiError.notFound("Project");
  return toProject(data);
}

export async function deleteProject(supabase: AppSupabaseClient, id: string): Promise<void> {
  const { data, error } = await supabase.from("projects").delete().eq("id", id).select("id");
  if (error) throw mapPostgrestError(error, "Project");
  if (data.length === 0) throw ApiError.notFound("Project");
}

/** Lightweight list for pickers (e.g. linking an automation to a project). */
export async function listProjectOptions(
  supabase: AppSupabaseClient,
): Promise<Array<Pick<Project, "id" | "name" | "status">>> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, status")
    .neq("status", "archived")
    .order("name")
    .limit(500);
  if (error) throw mapPostgrestError(error, "Project");
  return data;
}
