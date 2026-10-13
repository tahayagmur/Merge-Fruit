import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapPostgrestError } from "@/lib/api/postgrest-errors";
import type { Agent, AgentTask, AgentTaskStatus, Page } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import type {
  AgentCreateInput,
  AgentListQuery,
  AgentTaskCreateInput,
  AgentTaskUpdateInput,
  AgentUpdateInput,
} from "@/lib/validation/agents";
import { toAgent, toAgentTask } from "./mappers";
import { pageRange, searchFilter, toPage } from "./query-helpers";

export const AGENTS_PAGE_SIZE = 20;

export type AgentTaskCounts = Partial<Record<AgentTaskStatus, number>>;

export async function listAgents(
  supabase: AppSupabaseClient,
  filters: Partial<AgentListQuery> & { pageSize?: number } = {},
): Promise<Page<Agent>> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? AGENTS_PAGE_SIZE;
  const [from, to] = pageRange(page, pageSize);
  let query = supabase
    .from("agent_definitions")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.q) query = query.or(searchFilter(["name", "description"], filters.q));
  const { data, error, count } = await query;
  if (error) throw mapPostgrestError(error, "Agent");
  return toPage(data.map(toAgent), count, page, pageSize);
}

/** Task counts per agent and status, for list badges. */
export async function countAgentTasks(supabase: AppSupabaseClient): Promise<Map<string, AgentTaskCounts>> {
  const { data, error } = await supabase.from("agent_task_records").select("agent_id, status").limit(5000);
  if (error) throw mapPostgrestError(error, "Agent task");
  const counts = new Map<string, AgentTaskCounts>();
  for (const row of data) {
    const entry = counts.get(row.agent_id) ?? {};
    entry[row.status] = (entry[row.status] ?? 0) + 1;
    counts.set(row.agent_id, entry);
  }
  return counts;
}

export async function getAgent(supabase: AppSupabaseClient, id: string): Promise<Agent | null> {
  const { data, error } = await supabase.from("agent_definitions").select("*").eq("id", id).maybeSingle();
  if (error) throw mapPostgrestError(error, "Agent");
  return data ? toAgent(data) : null;
}

export async function createAgent(supabase: AppSupabaseClient, ownerId: string, input: AgentCreateInput): Promise<Agent> {
  const { data, error } = await supabase
    .from("agent_definitions")
    .insert({
      owner_id: ownerId,
      name: input.name,
      description: input.description,
      instructions: input.instructions,
      provider: input.provider,
      model: input.model,
      capabilities: input.capabilities,
      status: input.status,
    })
    .select()
    .single();
  if (error) throw mapPostgrestError(error, "Agent");
  return toAgent(data);
}

export async function updateAgent(supabase: AppSupabaseClient, id: string, input: AgentUpdateInput): Promise<Agent> {
  const { data, error } = await supabase
    .from("agent_definitions")
    .update({
      name: input.name,
      description: input.description,
      instructions: input.instructions,
      provider: input.provider,
      model: input.model,
      capabilities: input.capabilities,
      status: input.status,
    })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw mapPostgrestError(error, "Agent");
  if (!data) throw ApiError.notFound("Agent");
  return toAgent(data);
}

export async function deleteAgent(supabase: AppSupabaseClient, id: string): Promise<void> {
  const { data, error } = await supabase.from("agent_definitions").delete().eq("id", id).select("id");
  if (error) throw mapPostgrestError(error, "Agent");
  if (data.length === 0) throw ApiError.notFound("Agent");
}

export async function listAgentTasks(supabase: AppSupabaseClient, agentId: string, limit = 50): Promise<AgentTask[]> {
  const { data, error } = await supabase
    .from("agent_task_records")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw mapPostgrestError(error, "Agent task");
  return data.map(toAgentTask);
}

export async function listQueuedAgentTasks(
  supabase: AppSupabaseClient,
  options: { limit?: number; includeDemo?: boolean } = {},
): Promise<Array<AgentTask & { agentName: string }>> {
  let query = supabase
    .from("agent_task_records")
    .select("*, agent:agent_definitions!agent_task_records_agent_owner_fkey(name)")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(options.limit ?? 5);
  if (!options.includeDemo) query = query.eq("is_demo", false);
  const { data, error } = await query;
  if (error) throw mapPostgrestError(error, "Agent task");
  return data.map(({ agent, ...row }) => ({ ...toAgentTask(row), agentName: agent?.name ?? "Unknown agent" }));
}

export async function createAgentTask(
  supabase: AppSupabaseClient,
  ownerId: string,
  agentId: string,
  input: AgentTaskCreateInput,
): Promise<AgentTask> {
  const agent = await getAgent(supabase, agentId);
  if (!agent) throw ApiError.notFound("Agent");
  if (input.projectId) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", input.projectId)
      .maybeSingle();
    if (projectError) throw mapPostgrestError(projectError, "Project");
    if (!project) {
      throw new ApiError("VALIDATION_ERROR", "The linked project does not exist.", [
        { path: "projectId", message: "Project not found." },
      ]);
    }
  }
  const { data, error } = await supabase
    .from("agent_task_records")
    .insert({ owner_id: ownerId, agent_id: agentId, project_id: input.projectId, title: input.title, input: input.input })
    .select()
    .single();
  if (error) throw mapPostgrestError(error, "Agent task");
  return toAgentTask(data);
}

export async function updateAgentTask(
  supabase: AppSupabaseClient,
  id: string,
  input: AgentTaskUpdateInput,
): Promise<AgentTask> {
  const { data, error } = await supabase
    .from("agent_task_records")
    .update({ title: input.title, input: input.input, status: input.status })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw mapPostgrestError(error, "Agent task");
  if (!data) throw ApiError.notFound("Agent task");
  return toAgentTask(data);
}

export async function deleteAgentTask(supabase: AppSupabaseClient, id: string): Promise<void> {
  const { data, error } = await supabase.from("agent_task_records").delete().eq("id", id).select("id");
  if (error) throw mapPostgrestError(error, "Agent task");
  if (data.length === 0) throw ApiError.notFound("Agent task");
}
