import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { Automation, Page } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import type {
  AutomationCreateInput,
  AutomationListQuery,
  AutomationUpdateInput,
} from "@/lib/validation/automations";
import { toAutomation } from "./mappers";
import { pageRange, searchFilter, toPage } from "./query-helpers";

export const AUTOMATIONS_PAGE_SIZE = 20;

async function assertProjectVisible(supabase: AppSupabaseClient, projectId: string | null | undefined) {
  if (!projectId) return;
  const { data, error } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (error) throw mapPostgrestError(error, "Project");
  if (!data) {
    throw new ApiError("VALIDATION_ERROR", "The linked project does not exist.", [
      { path: "projectId", message: "Project not found." },
    ]);
  }
}

export async function listAutomations(
  supabase: AppSupabaseClient,
  filters: Partial<AutomationListQuery> & { pageSize?: number } = {},
): Promise<Page<Automation>> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? AUTOMATIONS_PAGE_SIZE;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase
    .from("automations")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.q) query = query.or(searchFilter(["name", "description", "trigger_notes"], filters.q));

  const { data, error, count } = await query;
  if (error) throw mapPostgrestError(error, "Automation");
  return toPage(data.map(toAutomation), count, page, pageSize);
}

/** Counts per status across all of the user's automations (for the summary tiles). */
export async function countAutomationsByStatus(supabase: AppSupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("automations").select("status").limit(5000);
  if (error) throw mapPostgrestError(error, "Automation");
  const counts: Record<string, number> = { total: data.length };
  for (const row of data) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

export async function createAutomation(
  supabase: AppSupabaseClient,
  ownerId: string,
  input: AutomationCreateInput,
): Promise<Automation> {
  await assertProjectVisible(supabase, input.projectId);
  const { data, error } = await supabase
    .from("automations")
    .insert({
      owner_id: ownerId,
      project_id: input.projectId,
      name: input.name,
      description: input.description,
      trigger_type: input.triggerType,
      trigger_notes: input.triggerNotes,
      provider: input.provider,
      external_workflow_id: input.externalWorkflowId,
      status: input.status,
    })
    .select()
    .single();
  if (error) throw mapPostgrestError(error, "Automation");
  return toAutomation(data);
}

export async function updateAutomation(
  supabase: AppSupabaseClient,
  id: string,
  input: AutomationUpdateInput,
): Promise<Automation> {
  await assertProjectVisible(supabase, input.projectId);
  const { data, error } = await supabase
    .from("automations")
    .update({
      project_id: input.projectId,
      name: input.name,
      description: input.description,
      trigger_type: input.triggerType,
      trigger_notes: input.triggerNotes,
      provider: input.provider,
      external_workflow_id: input.externalWorkflowId,
      status: input.status,
    })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === "23514" && error.message.includes("requires_provider")) {
      throw new ApiError("VALIDATION_ERROR", "Choose the workflow engine for this workflow id.", [
        { path: "provider", message: "Required when a workflow id is set." },
      ]);
    }
    throw mapPostgrestError(error, "Automation");
  }
  if (!data) throw ApiError.notFound("Automation");
  return toAutomation(data);
}

export async function deleteAutomation(supabase: AppSupabaseClient, id: string): Promise<void> {
  const { data, error } = await supabase.from("automations").delete().eq("id", id).select("id");
  if (error) throw mapPostgrestError(error, "Automation");
  if (data.length === 0) throw ApiError.notFound("Automation");
}
