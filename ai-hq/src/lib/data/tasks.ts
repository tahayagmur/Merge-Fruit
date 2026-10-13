import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { Task, TaskWithProject } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import type { TaskCreateInput, TaskUpdateInput } from "@/lib/validation/tasks";
import { toTask } from "./mappers";

const STATUS_ORDER: Record<Task["status"], number> = { in_progress: 0, blocked: 1, todo: 2, done: 3 };
const PRIORITY_ORDER: Record<Task["priority"], number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export async function listTasks(supabase: AppSupabaseClient, projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw mapPostgrestError(error, "Task");
  return sortTasks(data.map(toTask));
}

/** Open tasks across all projects, soonest due first (no due date last). */
export async function listUpcomingTasks(supabase: AppSupabaseClient, limit = 8): Promise<TaskWithProject[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, project:projects!tasks_project_owner_fkey(name)")
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw mapPostgrestError(error, "Task");
  return data.map(({ project, ...row }) => ({ ...toTask(row), projectName: project?.name ?? "Unknown project" }));
}

export async function createTask(
  supabase: AppSupabaseClient,
  ownerId: string,
  projectId: string,
  input: TaskCreateInput,
): Promise<Task> {
  // Check visibility first so a missing or foreign project yields a clean 404
  // instead of a foreign-key error (RLS hides other users' projects).
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw mapPostgrestError(projectError, "Project");
  if (!project) throw ApiError.notFound("Project");

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      owner_id: ownerId,
      project_id: projectId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      due_date: input.dueDate,
    })
    .select()
    .single();
  if (error) throw mapPostgrestError(error, "Task");
  return toTask(data);
}

export async function updateTask(supabase: AppSupabaseClient, id: string, input: TaskUpdateInput): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      due_date: input.dueDate,
    })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw mapPostgrestError(error, "Task");
  if (!data) throw ApiError.notFound("Task");
  return toTask(data);
}

export async function deleteTask(supabase: AppSupabaseClient, id: string): Promise<void> {
  const { data, error } = await supabase.from("tasks").delete().eq("id", id).select("id");
  if (error) throw mapPostgrestError(error, "Task");
  if (data.length === 0) throw ApiError.notFound("Task");
}
