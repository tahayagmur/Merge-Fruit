"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useId, useState } from "react";
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
  type Project,
  PROJECT_CATEGORIES,
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type ProjectCategory,
  type ProjectStatus,
} from "@/lib/domain";

interface ProjectFormDialogProps {
  project?: Project;
  trigger: ReactNode;
  /** Navigate to the new project after creating it. */
  openAfterCreate?: boolean;
  defaultCategory?: ProjectCategory;
}

export function ProjectFormDialog({ project, trigger, openAfterCreate, defaultCategory }: ProjectFormDialogProps) {
  const uid = useId();
  const router = useRouter();
  const editing = Boolean(project);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "planning");
  const [category, setCategory] = useState<ProjectCategory>(project?.category ?? defaultCategory ?? "general");
  const [priority, setPriority] = useState<Priority>(project?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(project?.dueDate ?? "");

  function reset() {
    setErrors({});
    if (!project) {
      setName("");
      setDescription("");
      setStatus("planning");
      setCategory(defaultCategory ?? "general");
      setPriority("medium");
      setDueDate("");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    const body = { name, description, status, category, priority, dueDate };
    try {
      const saved = project
        ? await apiRequest<Project>(`/api/projects/${project.id}`, { method: "PATCH", body })
        : await apiRequest<Project>("/api/projects", { method: "POST", body });
      toast.success(editing ? "Project updated" : "Project created");
      setOpen(false);
      reset();
      if (!editing && openAfterCreate) router.push(`/projects/${saved.id}`);
      else router.refresh();
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the project details." : "Projects group tasks and automations."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField id={`${uid}-project-name`} label="Name" error={errors.name}>
            <Input
              id={`${uid}-project-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="e.g. Launch AI HQ"
              aria-invalid={Boolean(errors.name)}
              autoFocus
              required
            />
          </FormField>
          <FormField id={`${uid}-project-description`} label="Description" error={errors.description}>
            <Textarea
              id={`${uid}-project-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              placeholder="Goal, scope, links…"
              aria-invalid={Boolean(errors.description)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id={`${uid}-project-status`} label="Status" error={errors.status}>
              <OptionSelect
                id={`${uid}-project-status`}
                value={status}
                options={PROJECT_STATUSES}
                labels={PROJECT_STATUS_LABELS}
                onChange={setStatus}
              />
            </FormField>
            <FormField id={`${uid}-project-category`} label="Category" error={errors.category}>
              <OptionSelect
                id={`${uid}-project-category`}
                value={category}
                options={PROJECT_CATEGORIES}
                labels={PROJECT_CATEGORY_LABELS}
                onChange={setCategory}
              />
            </FormField>
            <FormField id={`${uid}-project-priority`} label="Priority" error={errors.priority}>
              <OptionSelect
                id={`${uid}-project-priority`}
                value={priority}
                options={PRIORITIES}
                labels={PRIORITY_LABELS}
                onChange={setPriority}
              />
            </FormField>
            <FormField id={`${uid}-project-due`} label="Due date" error={errors.dueDate}>
              <Input
                id={`${uid}-project-due`}
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
              {editing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
