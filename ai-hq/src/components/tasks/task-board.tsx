"use client";

import { CalendarDays, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { OptionSelect } from "@/components/common/option-select";
import { PriorityBadge } from "@/components/common/status-badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, errorMessage } from "@/lib/api-client";
import { type Task, TASK_STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "@/lib/domain";
import { formatDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TaskFormDialog } from "./task-form-dialog";

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  todo: "bg-muted-foreground",
  in_progress: "bg-primary",
  blocked: "bg-destructive",
  done: "bg-success",
};

function TaskCard({ task, projectId, today }: { task: Task; projectId: string; today: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const overdue = isOverdue(task.dueDate, status, today);

  async function changeStatus(next: TaskStatus) {
    const previous = status;
    setStatus(next);
    setSaving(true);
    try {
      await apiRequest(`/api/tasks/${task.id}`, { method: "PATCH", body: { status: next } });
      startRefresh(() => router.refresh());
    } catch (error) {
      setStatus(previous);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await apiRequest(`/api/tasks/${task.id}`, { method: "DELETE" });
      toast.success("Task deleted");
      startRefresh(() => router.refresh());
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  return (
    <li
      className={cn(
        "group space-y-3 rounded-lg border bg-card p-3 transition-opacity",
        (saving || refreshing) && "opacity-70",
      )}
      data-testid="task-card"
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm leading-snug font-medium", status === "done" && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1 shrink-0" aria-label={`Actions for ${task.title}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <TaskFormDialog projectId={projectId} task={task} open={editOpen} onOpenChange={setEditOpen} />
        <ConfirmDelete
          title="Delete this task?"
          description={`“${task.title}” will be permanently deleted.`}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirm={remove}
        />
      </div>
      {task.description && <p className="line-clamp-3 text-xs text-muted-foreground">{task.description}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", overdue && "text-warning")}>
            <CalendarDays className="size-3" />
            {formatDate(task.dueDate, { short: true })}
            {overdue && " · overdue"}
          </span>
        )}
      </div>
      <OptionSelect
        id={`task-status-${task.id}`}
        aria-label={`Status of ${task.title}`}
        size="sm"
        className="w-full"
        value={status}
        options={TASK_STATUSES}
        labels={TASK_STATUS_LABELS}
        onChange={changeStatus}
        disabled={saving}
      />
    </li>
  );
}

export function TaskBoard({ tasks, projectId, today }: { tasks: Task[]; projectId: string; today: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return (
          <section
            key={status}
            aria-label={TASK_STATUS_LABELS[status]}
            className="flex min-h-40 flex-col gap-3 rounded-xl border bg-muted/30 p-3"
          >
            <header className="flex items-center justify-between px-1">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <span className={cn("size-1.5 rounded-full", COLUMN_ACCENT[status])} aria-hidden />
                {TASK_STATUS_LABELS[status]}
                <span className="font-mono text-xs text-muted-foreground">{columnTasks.length}</span>
              </h3>
              <TaskFormDialog
                projectId={projectId}
                defaultStatus={status}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Add task to ${TASK_STATUS_LABELS[status]}`}>
                    <Plus />
                  </Button>
                }
              />
            </header>
            {columnTasks.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">No tasks</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {columnTasks.map((task) => (
                  <TaskCard key={`${task.id}-${task.updatedAt}`} task={task} projectId={projectId} today={today} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
