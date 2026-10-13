import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { demoAgents, demoProjects } from "./dataset";

export interface DemoDataStatus {
  projects: number;
  tasks: number;
  automations: number;
  agents: number;
  agentTasks: number;
  total: number;
}

const TABLES = ["projects", "tasks", "automations", "agent_definitions", "agent_task_records"] as const;

export async function getDemoDataStatus(supabase: AppSupabaseClient): Promise<DemoDataStatus> {
  const counts = await Promise.all(
    TABLES.map(async (table) => {
      const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("is_demo", true);
      if (error) throw mapPostgrestError(error, "Demo data");
      return count ?? 0;
    }),
  );
  const [projects, tasks, automations, agents, agentTasks] = counts;
  return { projects, tasks, automations, agents, agentTasks, total: counts.reduce((sum, value) => sum + value, 0) };
}

/**
 * Loads the demo dataset for the signed-in user. Runs with the user's own
 * session, so RLS applies and every row is owned by them. Refused in
 * production and when demo data is already present.
 */
export async function loadDemoData(
  supabase: AppSupabaseClient,
  ownerId: string,
  appEnv: string,
): Promise<DemoDataStatus> {
  if (appEnv === "production") {
    throw new ApiError("FORBIDDEN", "Demo data cannot be loaded in production.");
  }
  const current = await getDemoDataStatus(supabase);
  if (current.total > 0) throw new ApiError("CONFLICT", "Demo data is already loaded. Remove it first to reload.");

  const projectIds: string[] = [];
  try {
    for (const demo of demoProjects()) {
      const { data: project, error } = await supabase
        .from("projects")
        .insert({ ...demo.project, owner_id: ownerId, is_demo: true })
        .select("id")
        .single();
      if (error) throw mapPostgrestError(error, "Demo project");
      projectIds.push(project.id);

      if (demo.tasks.length > 0) {
        const { error: taskError } = await supabase
          .from("tasks")
          .insert(demo.tasks.map((task) => ({ ...task, owner_id: ownerId, project_id: project.id, is_demo: true })));
        if (taskError) throw mapPostgrestError(taskError, "Demo task");
      }
      if (demo.automations.length > 0) {
        const { error: automationError } = await supabase
          .from("automations")
          .insert(demo.automations.map((item) => ({ ...item, owner_id: ownerId, project_id: project.id, is_demo: true })));
        if (automationError) throw mapPostgrestError(automationError, "Demo automation");
      }
    }

    for (const demo of demoAgents()) {
      const { data: agent, error } = await supabase
        .from("agent_definitions")
        .insert({ ...demo.agent, owner_id: ownerId, is_demo: true })
        .select("id")
        .single();
      if (error) throw mapPostgrestError(error, "Demo agent");
      if (demo.tasks.length > 0) {
        const { error: taskError } = await supabase.from("agent_task_records").insert(
          demo.tasks.map(({ projectIndex, ...task }) => ({
            ...task,
            owner_id: ownerId,
            agent_id: agent.id,
            project_id: projectIndex === undefined ? null : (projectIds[projectIndex] ?? null),
            is_demo: true,
          })),
        );
        if (taskError) throw mapPostgrestError(taskError, "Demo agent task");
      }
    }
  } catch (error) {
    // Leave no half-loaded dataset behind.
    await removeDemoData(supabase).catch(() => undefined);
    throw error;
  }

  return getDemoDataStatus(supabase);
}

/** Deletes every demo record owned by the signed-in user. Real data is never touched. */
export async function removeDemoData(supabase: AppSupabaseClient): Promise<DemoDataStatus> {
  // Children first; agents and projects cascade, but explicit deletes keep this independent of FK rules.
  for (const table of ["agent_task_records", "agent_definitions", "automations", "tasks", "projects"] as const) {
    const { error } = await supabase.from(table).delete().eq("is_demo", true);
    if (error) throw mapPostgrestError(error, "Demo data");
  }
  return getDemoDataStatus(supabase);
}
