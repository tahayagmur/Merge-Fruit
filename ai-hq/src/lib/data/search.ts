import "server-only";

import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import { AGENT_STATUS_LABELS, AUTOMATION_STATUS_LABELS, PROJECT_STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { searchFilter } from "./query-helpers";

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  isDemo: boolean;
}

export interface SearchResults {
  query: string;
  projects: SearchHit[];
  tasks: SearchHit[];
  automations: SearchHit[];
  agents: SearchHit[];
}

/** Searches the signed-in user's own records (RLS applies). `term` must be sanitised. */
export async function globalSearch(supabase: AppSupabaseClient, term: string, limit = 6): Promise<SearchResults> {
  const [projects, tasks, automations, agents] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, is_demo")
      .or(searchFilter(["name", "description"], term))
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("tasks")
      .select("id, title, status, project_id, is_demo")
      .or(searchFilter(["title", "description"], term))
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("automations")
      .select("id, name, status, is_demo")
      .or(searchFilter(["name", "description"], term))
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("agent_definitions")
      .select("id, name, status, is_demo")
      .or(searchFilter(["name", "description"], term))
      .order("updated_at", { ascending: false })
      .limit(limit),
  ]);

  for (const result of [projects, tasks, automations, agents]) {
    if (result.error) throw mapPostgrestError(result.error, "Search");
  }

  return {
    query: term,
    projects: (projects.data ?? []).map((row) => ({
      id: row.id,
      title: row.name,
      subtitle: PROJECT_STATUS_LABELS[row.status],
      href: `/projects/${row.id}`,
      isDemo: row.is_demo,
    })),
    tasks: (tasks.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: TASK_STATUS_LABELS[row.status],
      href: `/projects/${row.project_id}`,
      isDemo: row.is_demo,
    })),
    automations: (automations.data ?? []).map((row) => ({
      id: row.id,
      title: row.name,
      subtitle: AUTOMATION_STATUS_LABELS[row.status],
      href: `/automation?q=${encodeURIComponent(row.name.slice(0, 60))}`,
      isDemo: row.is_demo,
    })),
    agents: (agents.data ?? []).map((row) => ({
      id: row.id,
      title: row.name,
      subtitle: AGENT_STATUS_LABELS[row.status],
      href: `/agents/${row.id}`,
      isDemo: row.is_demo,
    })),
  };
}
