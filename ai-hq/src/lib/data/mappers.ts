import type { Database } from "@/lib/database.types";
import type {
  ActivityEntry,
  Automation,
  CommandCenterSummary,
  Project,
  ProjectSummary,
  Task,
} from "@/lib/domain";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];

export type ProjectRow = Tables["projects"]["Row"];
export type ProjectOverviewRow = Views["project_overview"]["Row"];
export type TaskRow = Tables["tasks"]["Row"];
export type AutomationRow = Tables["automations"]["Row"];
export type ActivityRow = Tables["activity_logs"]["Row"];

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    category: row.category,
    priority: row.priority,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toProjectSummary(row: ProjectOverviewRow): ProjectSummary {
  return {
    ...toProject(row),
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
    n8nWorkflowId: row.n8n_workflow_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toActivityEntry(row: ActivityRow): ActivityEntry {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    summary: row.summary,
    metadata,
    createdAt: row.created_at,
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
  };
}
