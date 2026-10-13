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
export const ACTIVITY_ENTITY_TYPES = [
  "project",
  "task",
  "automation",
  "agent",
  "agent_task",
  "profile",
  "system_settings",
  "integration",
] as const;
export const ACTIVITY_ACTIONS = ["created", "updated", "status_changed", "deleted"] as const;
export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;
export const AGENT_STATUSES = ["draft", "ready", "disabled"] as const;
export const AGENT_TASK_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export const AGENT_CAPABILITIES = [
  "research",
  "summarize",
  "write",
  "analyze_data",
  "plan",
  "review",
  "code",
  "translate",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type AgentTaskStatus = (typeof AGENT_TASK_STATUSES)[number];
export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

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
  ready: "Ready to link",
  paused: "Paused",
};

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  disabled: "Disabled",
};

export const AGENT_TASK_STATUS_LABELS: Record<AgentTaskStatus, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const AGENT_CAPABILITY_LABELS: Record<AgentCapability, string> = {
  research: "Research",
  summarize: "Summarize",
  write: "Write",
  analyze_data: "Analyze data",
  plan: "Plan",
  review: "Review",
  code: "Code",
  translate: "Translate",
};

export const ACTIVITY_ENTITY_LABELS: Record<ActivityEntityType, string> = {
  project: "Project",
  task: "Task",
  automation: "Automation",
  agent: "Agent",
  agent_task: "Agent task",
  profile: "User",
  system_settings: "Settings",
  integration: "Integration",
};

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  category: ProjectCategory;
  priority: Priority;
  dueDate: string | null;
  isDemo: boolean;
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
  isDemo: boolean;
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
  /** Integration key of the workflow engine (e.g. "n8n"). */
  provider: string | null;
  /** Identifier of the workflow inside that engine. Never a URL or secret. */
  externalWorkflowId: string | null;
  status: AutomationStatus;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: number;
  entityType: ActivityEntityType;
  entityId: string | null;
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
  agentsTotal: number;
  agentsReady: number;
  agentTasksQueued: number;
  /** Demo records owned by the user, whether or not they are included above. */
  demoRecords: number;
  /** "Today" in the workspace time zone (YYYY-MM-DD). */
  today: string;
}

export interface Profile {
  id: string;
  email: string | null;
  displayName: string | null;
  role: WorkspaceRole;
  createdAt: string;
}

export interface SystemSettings {
  workspaceName: string;
  timezone: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  instructions: string;
  provider: string | null;
  model: string | null;
  capabilities: AgentCapability[];
  status: AgentStatus;
  version: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTask {
  id: string;
  agentId: string;
  projectId: string | null;
  title: string;
  input: string;
  status: AgentTaskStatus;
  agentVersion: number;
  output: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
