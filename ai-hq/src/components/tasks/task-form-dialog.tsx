"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { OptionSelect } from "@/components/common/option-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiRequest, errorMessage } from "@/lib/api-client";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  type Priority,
  type Task,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskStatus,
} from "@/lib/domain";

interface TaskFormDialogProps {
  projectId: string;
  task?: Task;
  /** Omit when controlling the dialog with `open` / `onOpenChange`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultStatus?: TaskStatus;
}

export function TaskFormDialog({
  projectId,
  task,
  trigger,
  open: controlledOpen,
  onOpenChange,
  defaultStatus = "todo",
}: TaskFormDialogProps) {
  const router = useRouter();
  const editing = Boolean(task);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaultStatus);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");

  function reset() {
    setErrors({});
    if (!task) {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus);
      setPriority("medium");
      setDueDate("");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    const body = { title, description, status, priority, dueDate };
    try {
      if (task) await apiRequest<Task>(`/api/tasks/${task.id}`, { method: "PATCH", body });
      else await apiRequest<Task>(`/api/projects/${projectId}/tasks`, { method: "POST", body });
      toast.success(editing ? "Task updated" : "Task added");
      setOpen(false);
      reset();
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) setErrors(error.fieldErrors());
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>{editing ? "Update the task." : "Add a task to this project."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField id="task-title" label="Title" error={errors.title}>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              aria-invalid={Boolean(errors.title)}
              autoFocus
              required
            />
          </FormField>
          <FormField id="task-description" label="Description" error={errors.description}>
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
              aria-invalid={Boolean(errors.description)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField id="task-status" label="Status" error={errors.status}>
              <OptionSelect
                id="task-status"
                value={status}
                options={TASK_STATUSES}
                labels={TASK_STATUS_LABELS}
                onChange={setStatus}
              />
            </FormField>
            <FormField id="task-priority" label="Priority" error={errors.priority}>
              <OptionSelect
                id="task-priority"
                value={priority}
                options={PRIORITIES}
                labels={PRIORITY_LABELS}
                onChange={setPriority}
              />
            </FormField>
            <FormField id="task-due" label="Due date" error={errors.dueDate}>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                aria-invalid={Boolean(errors.dueDate)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
