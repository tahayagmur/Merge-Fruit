import { Badge } from "@/components/ui/badge";
import {
  AGENT_STATUS_LABELS,
  AGENT_TASK_STATUS_LABELS,
  type AgentStatus,
  type AgentTaskStatus,
  AUTOMATION_STATUS_LABELS,
  type AutomationStatus,
  type Priority,
  PRIORITY_LABELS,
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
  type ProjectCategory,
  type ProjectStatus,
  TASK_STATUS_LABELS,
  type TaskStatus,
  WORKSPACE_ROLE_LABELS,
  type WorkspaceRole,
} from "@/lib/domain";
import type { IntegrationStatus } from "@/lib/integrations/types";
import { StatusIndicator, type Tone } from "./status-indicator";

type Variant = "accent" | "success" | "warning" | "destructive" | "muted" | "outline";

const PROJECT_STATUS_VARIANT: Record<ProjectStatus, Variant> = {
  planning: "outline",
  active: "accent",
  on_hold: "warning",
  completed: "success",
  archived: "muted",
};

const TASK_STATUS_VARIANT: Record<TaskStatus, Variant> = {
  todo: "outline",
  in_progress: "accent",
  blocked: "destructive",
  done: "success",
};

const PRIORITY_VARIANT: Record<Priority, Variant> = {
  low: "muted",
  medium: "outline",
  high: "warning",
  critical: "destructive",
};

const AUTOMATION_STATUS_VARIANT: Record<AutomationStatus, Variant> = {
  draft: "outline",
  ready: "accent",
  paused: "muted",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={PROJECT_STATUS_VARIANT[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={TASK_STATUS_VARIANT[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}

export function CategoryBadge({ category }: { category: ProjectCategory }) {
  return <Badge variant="muted">{PROJECT_CATEGORY_LABELS[category]}</Badge>;
}

export function AutomationStatusBadge({ status }: { status: AutomationStatus }) {
  return <Badge variant={AUTOMATION_STATUS_VARIANT[status]}>{AUTOMATION_STATUS_LABELS[status]}</Badge>;
}

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_configured: "Not configured",
  ready_to_configure: "Ready to configure",
  connected: "Connected",
  error: "Error",
};

export const INTEGRATION_STATUS_TONE: Record<IntegrationStatus, Tone> = {
  not_configured: "neutral",
  ready_to_configure: "info",
  connected: "success",
  error: "danger",
};

const AGENT_STATUS_TONE: Record<AgentStatus, Tone> = { draft: "neutral", ready: "accent", disabled: "warning" };
const AGENT_TASK_STATUS_TONE: Record<AgentTaskStatus, Tone> = {
  queued: "info",
  running: "accent",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
};
const ROLE_TONE: Record<WorkspaceRole, Tone> = { owner: "accent", admin: "info", member: "neutral" };

export function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  return <StatusIndicator tone={INTEGRATION_STATUS_TONE[status]} label={INTEGRATION_STATUS_LABELS[status]} />;
}

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return <StatusIndicator tone={AGENT_STATUS_TONE[status]} label={AGENT_STATUS_LABELS[status]} />;
}

export function AgentTaskStatusBadge({ status }: { status: AgentTaskStatus }) {
  return <StatusIndicator tone={AGENT_TASK_STATUS_TONE[status]} label={AGENT_TASK_STATUS_LABELS[status]} />;
}

export function RoleBadge({ role }: { role: WorkspaceRole }) {
  return <StatusIndicator tone={ROLE_TONE[role]} label={WORKSPACE_ROLE_LABELS[role]} />;
}
