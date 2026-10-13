import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { Automation } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import type { AutomationCreateInput, AutomationUpdateInput } from "@/lib/validation/automations";
import { toAutomation } from "./mappers";

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

export async function listAutomations(supabase: AppSupabaseClient): Promise<Automation[]> {
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw mapPostgrestError(error, "Automation");
  return data.map(toAutomation);
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
      n8n_workflow_id: input.n8nWorkflowId,
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
      n8n_workflow_id: input.n8nWorkflowId,
      status: input.status,
    })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw mapPostgrestError(error, "Automation");
  if (!data) throw ApiError.notFound("Automation");
  return toAutomation(data);
}

export async function deleteAutomation(supabase: AppSupabaseClient, id: string): Promise<void> {
  const { data, error } = await supabase.from("automations").delete().eq("id", id).select("id");
  if (error) throw mapPostgrestError(error, "Automation");
  if (data.length === 0) throw ApiError.notFound("Automation");
}
