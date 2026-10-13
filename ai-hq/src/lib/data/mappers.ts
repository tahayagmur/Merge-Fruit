import type { Database } from "@/lib/database.types";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  AGENT_CAPABILITIES,
  type ActivityEntry,
  type Agent,
  type AgentCapability,
  type AgentTask,
  type Automation,
  type CommandCenterSummary,
  type Profile,
  type Project,
  type ProjectSummary,
  type SystemSettings,
  type Task,
} from "@/lib/domain";
import type { IntegrationConfigRecord } from "@/lib/integrations/types";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];

export type ProjectRow = Tables["projects"]["Row"];
export type ProjectOverviewRow = Views["project_overview"]["Row"];
export type TaskRow = Tables["tasks"]["Row"];
export type AutomationRow = Tables["automations"]["Row"];
export type ActivityRow = Tables["activity_logs"]["Row"];
export type ProfileRow = Tables["profiles"]["Row"];
export type SystemSettingsRow = Tables["system_settings"]["Row"];
export type IntegrationConfigRow = Tables["integration_configs"]["Row"];
export type AgentRow = Tables["agent_definitions"]["Row"];
export type AgentTaskRow = Tables["agent_task_records"]["Row"];

/** View columns are typed nullable by the generator; these are NOT NULL in the underlying table. */
function required<T>(value: T | null, field: string): T {
  if (value === null) throw new Error(`Unexpected null in ${field}`);
  return value;
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    category: row.category,
    priority: row.priority,
    dueDate: row.due_date,
    isDemo: row.is_demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toProjectSummary(row: ProjectOverviewRow): ProjectSummary {
  return {
    id: required(row.id, "project_overview.id"),
    name: required(row.name, "project_overview.name"),
    description: row.description,
    status: required(row.status, "project_overview.status"),
    category: required(row.category, "project_overview.category"),
    priority: required(row.priority, "project_overview.priority"),
    dueDate: row.due_date,
    isDemo: row.is_demo ?? false,
    createdAt: required(row.created_at, "project_overview.created_at"),
    updatedAt: required(row.updated_at, "project_overview.updated_at"),
    taskTotal: row.task_total ?? 0,
    taskDone: row.task_done ?? 0,
    taskBlocked: row.task_blocked ?? 0,
    taskOverdue: row.task_overdue ?? 0,
  };
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    isDemo: row.is_demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAutomation(row: AutomationRow): Automation {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type,
    triggerNotes: row.trigger_notes,
    provider: row.provider,
    externalWorkflowId: row.external_workflow_id,
    status: row.status,
    isDemo: row.is_demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

export function toActivityEntry(row: ActivityRow): ActivityEntry {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    entityType: isOneOf(ACTIVITY_ENTITY_TYPES, row.entity_type) ? row.entity_type : "project",
    entityId: row.entity_id,
    action: isOneOf(ACTIVITY_ACTIONS, row.action) ? row.action : "updated",
    summary: row.summary,
    metadata,
    createdAt: row.created_at,
  };
}

export function toProfile(row: Pick<ProfileRow, "id" | "email" | "display_name" | "role" | "created_at">): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function toSystemSettings(row: SystemSettingsRow): SystemSettings {
  return { workspaceName: row.workspace_name, timezone: row.timezone, updatedAt: row.updated_at };
}

export function toIntegrationConfig(row: IntegrationConfigRow): IntegrationConfigRecord {
  const settings =
    row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
      ? (row.settings as Record<string, unknown>)
      : {};
  return {
    key: row.key,
    enabled: row.enabled,
    settings,
    lastTestStatus: row.last_test_status === "succeeded" || row.last_test_status === "failed" ? row.last_test_status : null,
    lastTestMessage: row.last_test_message,
    lastTestedAt: row.last_tested_at,
    testedSettingsHash: row.tested_settings_hash,
    updatedAt: row.updated_at,
  };
}

export function toAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    provider: row.provider,
    model: row.model,
    capabilities: row.capabilities.filter((value): value is AgentCapability => isOneOf(AGENT_CAPABILITIES, value)),
    status: row.status,
    version: row.version,
    isDemo: row.is_demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAgentTask(row: AgentTaskRow): AgentTask {
  return {
    id: row.id,
    agentId: row.agent_id,
    projectId: row.project_id,
    title: row.title,
    input: row.input,
    status: row.status,
    agentVersion: row.agent_version,
    output: row.output,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    isDemo: row.is_demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function count(source: Record<string, unknown>, key: string): number {
  const value = Number(source[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function toCommandCenterSummary(raw: unknown): CommandCenterSummary {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    projectsTotal: count(source, "projects_total"),
    projectsActive: count(source, "projects_active"),
    tasksOpen: count(source, "tasks_open"),
    tasksInProgress: count(source, "tasks_in_progress"),
    tasksBlocked: count(source, "tasks_blocked"),
    tasksOverdue: count(source, "tasks_overdue"),
    tasksDoneLast7Days: count(source, "tasks_done_last_7_days"),
    automationsTotal: count(source, "automations_total"),
    agentsTotal: count(source, "agents_total"),
    agentsReady: count(source, "agents_ready"),
    agentTasksQueued: count(source, "agent_tasks_queued"),
    demoRecords: count(source, "demo_records"),
    today: typeof source.today === "string" ? source.today : new Date().toISOString().slice(0, 10),
  };
}
