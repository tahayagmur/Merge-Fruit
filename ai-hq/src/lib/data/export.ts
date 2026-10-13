import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { Database } from "@/lib/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/server";

type Tables = Database["public"]["Tables"];

/** Supabase caps responses (1000 rows by default), so every table is read page by page. */
const PAGE = 500;

async function readAll<Row>(
  page: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: PostgrestError | null }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw mapPostgrestError(error, "Export");
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export interface PersonalExport {
  format: "ai-hq-export";
  version: 1;
  exportedAt: string;
  user: { id: string; email: string | null };
  projects: Array<Tables["projects"]["Row"]>;
  tasks: Array<Tables["tasks"]["Row"]>;
  automations: Array<Tables["automations"]["Row"]>;
  agents: Array<Tables["agent_definitions"]["Row"]>;
  agentTasks: Array<Tables["agent_task_records"]["Row"]>;
  activity: Array<Tables["activity_logs"]["Row"]>;
}

/**
 * Everything the user owns, as stored. Filtered by owner explicitly: owners and
 * admins may read other users' activity, which never belongs in a personal export.
 * Workspace settings and integration settings are not personal data and are left out.
 */
export async function buildPersonalExport(
  supabase: AppSupabaseClient,
  user: { id: string; email: string | null },
  now: Date = new Date(),
): Promise<PersonalExport> {
  const owner = user.id;
  const [projects, tasks, automations, agents, agentTasks, activity] = await Promise.all([
    readAll((from, to) => supabase.from("projects").select("*").eq("owner_id", owner).order("id").range(from, to)),
    readAll((from, to) => supabase.from("tasks").select("*").eq("owner_id", owner).order("id").range(from, to)),
    readAll((from, to) => supabase.from("automations").select("*").eq("owner_id", owner).order("id").range(from, to)),
    readAll((from, to) =>
      supabase.from("agent_definitions").select("*").eq("owner_id", owner).order("id").range(from, to),
    ),
    readAll((from, to) =>
      supabase.from("agent_task_records").select("*").eq("owner_id", owner).order("id").range(from, to),
    ),
    readAll((from, to) => supabase.from("activity_logs").select("*").eq("owner_id", owner).order("id").range(from, to)),
  ]);
  return {
    format: "ai-hq-export",
    version: 1,
    exportedAt: now.toISOString(),
    user,
    projects,
    tasks,
    automations,
    agents,
    agentTasks,
    activity,
  };
}
