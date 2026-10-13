import "server-only";

import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { ActivityEntry } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import type { ActivityQuery } from "@/lib/validation/activity";
import { toActivityEntry } from "./mappers";

export interface ActivityPage {
  entries: ActivityEntry[];
  /** Pass as `before` to load the next (older) page; null when there is none. */
  nextCursor: number | null;
}

export async function listActivity(
  supabase: AppSupabaseClient,
  query: Partial<ActivityQuery> = {},
): Promise<ActivityPage> {
  const limit = query.limit ?? 50;
  let request = supabase
    .from("activity_logs")
    .select("*")
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (query.before) request = request.lt("id", query.before);
  if (query.entityType) request = request.eq("entity_type", query.entityType);

  const { data, error } = await request;
  if (error) throw mapPostgrestError(error, "Activity");

  const hasMore = data.length > limit;
  const entries = data.slice(0, limit).map(toActivityEntry);
  return { entries, nextCursor: hasMore ? entries[entries.length - 1].id : null };
}

/** Activity for a project and everything that happened inside it (tasks, linked automations). */
export async function listProjectActivity(
  supabase: AppSupabaseClient,
  projectId: string,
  limit = 20,
): Promise<ActivityEntry[]> {
  const [own, related] = await Promise.all([
    supabase.from("activity_logs").select("*").eq("entity_id", projectId).order("id", { ascending: false }).limit(limit),
    supabase
      .from("activity_logs")
      .select("*")
      .eq("metadata->>project_id", projectId)
      .order("id", { ascending: false })
      .limit(limit),
  ]);
  if (own.error) throw mapPostgrestError(own.error, "Activity");
  if (related.error) throw mapPostgrestError(related.error, "Activity");

  const byId = new Map<number, ActivityEntry>();
  for (const row of [...own.data, ...related.data]) byId.set(row.id, toActivityEntry(row));
  return [...byId.values()].sort((a, b) => b.id - a.id).slice(0, limit);
}
