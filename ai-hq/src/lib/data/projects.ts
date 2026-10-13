import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { Project, ProjectSummary } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import type { ProjectCreateInput, ProjectListQuery, ProjectUpdateInput } from "@/lib/validation/projects";
import { toProject, toProjectSummary } from "./mappers";

export async function listProjects(
  supabase: AppSupabaseClient,
  filters: ProjectListQuery = {},
): Promise<ProjectSummary[]> {
  let query = supabase.from("project_overview").select("*").order("updated_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);

  const { data, error } = await query;
  if (error) throw mapPostgrestError(error, "Project");
  return data.map(toProjectSummary);
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
    .order("name");
  if (error) throw mapPostgrestError(error, "Project");
  return data;
}
