/**
 * Domain vocabulary shared by validation, the data layer and the UI.
 * Values mirror the Postgres enums in supabase/migrations.
 */

export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "archived"] as const;
export const PROJECT_CATEGORIES = ["general", "automation", "game", "saas", "ai_agent"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const AUTOMATION_TRIGGERS = ["manual", "schedule", "webhook", "event"] as const;
export const AUTOMATION_STATUSES = ["draft", "ready", "paused"] as const;
export const ACTIVITY_ENTITY_TYPES = ["project", "task", "automation"] as const;
export const ACTIVITY_ACTIONS = ["created", "updated", "status_changed", "deleted"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  general: "General",
  automation: "Automation",
  game: "Game",
  saas: "SaaS & Business",
  ai_agent: "AI Agent",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  manual: "Manual",
  schedule: "Schedule",
  webhook: "Webhook",
  event: "AI HQ event",
};

export const AUTOMATION_STATUS_LABELS: Record<AutomationStatus, string> = {
  draft: "Draft",
  ready: "Ready for n8n",
  paused: "Paused",
};

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  category: ProjectCategory;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary extends Project {
  taskTotal: number;
  taskDone: number;
  taskBlocked: number;
  taskOverdue: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskWithProject extends Task {
  projectName: string;
}

export interface Automation {
  id: string;
  projectId: string | null;
  name: string;
  description: string | null;
  triggerType: AutomationTrigger;
  triggerNotes: string | null;
  n8nWorkflowId: string | null;
  status: AutomationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: number;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityAction;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CommandCenterSummary {
  projectsTotal: number;
  projectsActive: number;
  tasksOpen: number;
  tasksInProgress: number;
  tasksBlocked: number;
  tasksOverdue: number;
  tasksDoneLast7Days: number;
  automationsTotal: number;
}
