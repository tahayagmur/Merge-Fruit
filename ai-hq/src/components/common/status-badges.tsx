import { Badge } from "@/components/ui/badge";
import {
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
} from "@/lib/domain";

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
