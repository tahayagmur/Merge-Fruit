"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiRequest, errorMessage } from "@/lib/api-client";

const NO_PROJECT = "__none__";

interface AgentTaskDialogProps {
  agentId: string;
  projects: Array<{ id: string; name: string }>;
  trigger: ReactNode;
}

/** Queues a task record. No runtime picks it up in this phase. */
export function AgentTaskDialog({ agentId, projects, trigger }: AgentTaskDialogProps) {
  const uid = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const [projectId, setProjectId] = useState(NO_PROJECT);

  function reset() {
    setErrors({});
    setTitle("");
    setInput("");
    setProjectId(NO_PROJECT);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await apiRequest(`/api/agents/${agentId}/tasks`, {
        method: "POST",
        body: { title, input, projectId: projectId === NO_PROJECT ? null : projectId },
      });
      toast.success("Task queued");
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Queue a task</DialogTitle>
          <DialogDescription>
            The task is stored as Queued with the agent’s current version. It runs once an agent runtime is connected
            (planned for Phase 4); until then you can edit or cancel it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField id={`${uid}-agent-task-title`} label="Title" error={errors.title}>
            <Input
              id={`${uid}-agent-task-title`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              aria-invalid={Boolean(errors.title)}
              autoFocus
              required
            />
          </FormField>
          <FormField id={`${uid}-agent-task-input`} label="Input" error={errors.input} hint="What the agent should work on.">
            <Textarea
              id={`${uid}-agent-task-input`}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={20000}
              rows={6}
              aria-invalid={Boolean(errors.input)}
            />
          </FormField>
          <FormField id={`${uid}-agent-task-project`} label="Project (optional)" error={errors.projectId}>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id={`${uid}-agent-task-project`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Queue task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
