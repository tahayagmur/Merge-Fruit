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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiRequest, errorMessage } from "@/lib/api-client";
import {
  type Automation,
  AUTOMATION_STATUS_LABELS,
  AUTOMATION_STATUSES,
  AUTOMATION_TRIGGER_LABELS,
  AUTOMATION_TRIGGERS,
  type AutomationStatus,
  type AutomationTrigger,
} from "@/lib/domain";

export interface ProjectOption {
  id: string;
  name: string;
}

const NO_PROJECT = "__none__";

interface AutomationFormDialogProps {
  automation?: Automation;
  projects: ProjectOption[];
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AutomationFormDialog({
  automation,
  projects,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: AutomationFormDialogProps) {
  const router = useRouter();
  const editing = Boolean(automation);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState(automation?.name ?? "");
  const [description, setDescription] = useState(automation?.description ?? "");
  const [projectId, setProjectId] = useState(automation?.projectId ?? NO_PROJECT);
  const [triggerType, setTriggerType] = useState<AutomationTrigger>(automation?.triggerType ?? "manual");
  const [triggerNotes, setTriggerNotes] = useState(automation?.triggerNotes ?? "");
  const [workflowId, setWorkflowId] = useState(automation?.n8nWorkflowId ?? "");
  const [status, setStatus] = useState<AutomationStatus>(automation?.status ?? "draft");

  function reset() {
    setErrors({});
    if (!automation) {
      setName("");
      setDescription("");
      setProjectId(NO_PROJECT);
      setTriggerType("manual");
      setTriggerNotes("");
      setWorkflowId("");
      setStatus("draft");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    const body = {
      name,
      description,
      projectId: projectId === NO_PROJECT ? null : projectId,
      triggerType,
      triggerNotes,
      n8nWorkflowId: workflowId,
      status,
    };
    try {
      if (automation) await apiRequest(`/api/automations/${automation.id}`, { method: "PATCH", body });
      else await apiRequest("/api/automations", { method: "POST", body });
      toast.success(editing ? "Automation updated" : "Automation draft created");
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit automation" : "New automation"}</DialogTitle>
          <DialogDescription>
            Describe an automation you run in n8n. It is linked to your existing workflow in Phase 2; until then it is a catalogue entry and nothing runs.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField id="automation-name" label="Name" error={errors.name}>
            <Input
              id="automation-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="e.g. Weekly project digest"
              aria-invalid={Boolean(errors.name)}
              autoFocus
              required
            />
          </FormField>
          <FormField id="automation-description" label="What it does" error={errors.description}>
            <Textarea
              id="automation-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              placeholder="Steps, inputs and expected result"
              aria-invalid={Boolean(errors.description)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="automation-trigger" label="Trigger" error={errors.triggerType}>
              <OptionSelect
                id="automation-trigger"
                value={triggerType}
                options={AUTOMATION_TRIGGERS}
                labels={AUTOMATION_TRIGGER_LABELS}
                onChange={setTriggerType}
              />
            </FormField>
            <FormField id="automation-status" label="Status" error={errors.status}>
              <OptionSelect
                id="automation-status"
                value={status}
                options={AUTOMATION_STATUSES}
                labels={AUTOMATION_STATUS_LABELS}
                onChange={setStatus}
              />
            </FormField>
          </div>
          <FormField
            id="automation-trigger-notes"
            label="Trigger details"
            error={errors.triggerNotes}
            hint="e.g. “Every Monday 09:00” or “When a task is marked done”."
          >
            <Input
              id="automation-trigger-notes"
              value={triggerNotes}
              onChange={(event) => setTriggerNotes(event.target.value)}
              maxLength={500}
              aria-invalid={Boolean(errors.triggerNotes)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="automation-project" label="Project" error={errors.projectId}>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="automation-project" className="w-full">
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
            <FormField
              id="automation-workflow"
              label="n8n workflow id (optional)"
              error={errors.n8nWorkflowId}
              hint="Identifier only — never a URL or API key."
            >
              <Input
                id="automation-workflow"
                value={workflowId}
                onChange={(event) => setWorkflowId(event.target.value)}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                aria-invalid={Boolean(errors.n8nWorkflowId)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Save draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
