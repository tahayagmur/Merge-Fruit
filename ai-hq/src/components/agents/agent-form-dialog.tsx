"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { OptionSelect } from "@/components/common/option-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  type Agent,
  AGENT_CAPABILITIES,
  AGENT_CAPABILITY_LABELS,
  AGENT_STATUS_LABELS,
  AGENT_STATUSES,
  type AgentCapability,
  type AgentStatus,
} from "@/lib/domain";

/** A model-provider integration from the catalogue. */
export interface ProviderOption {
  key: string;
  name: string;
}

const NO_PROVIDER = "__none__";

interface AgentFormDialogProps {
  agent?: Agent;
  providers: ProviderOption[];
  trigger: ReactNode;
  /** Navigate to the new agent after creating it. */
  openAfterCreate?: boolean;
}

export function AgentFormDialog({ agent, providers, trigger, openAfterCreate }: AgentFormDialogProps) {
  const uid = useId();
  const router = useRouter();
  const editing = Boolean(agent);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState(agent?.name ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [instructions, setInstructions] = useState(agent?.instructions ?? "");
  const [provider, setProvider] = useState(agent?.provider ?? NO_PROVIDER);
  const [model, setModel] = useState(agent?.model ?? "");
  const [capabilities, setCapabilities] = useState<AgentCapability[]>(agent?.capabilities ?? []);
  const [status, setStatus] = useState<AgentStatus>(agent?.status ?? "draft");

  function reset() {
    setErrors({});
    if (!agent) {
      setName("");
      setDescription("");
      setInstructions("");
      setProvider(NO_PROVIDER);
      setModel("");
      setCapabilities([]);
      setStatus("draft");
    }
  }

  function toggleCapability(capability: AgentCapability, checked: boolean) {
    setCapabilities((current) =>
      checked ? [...new Set([...current, capability])] : current.filter((item) => item !== capability),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    const body = {
      name,
      description,
      instructions,
      provider: provider === NO_PROVIDER ? null : provider,
      model,
      capabilities,
      status,
    };
    try {
      const saved = agent
        ? await apiRequest<Agent>(`/api/agents/${agent.id}`, { method: "PATCH", body })
        : await apiRequest<Agent>("/api/agents", { method: "POST", body });
      toast.success(editing ? "Agent updated" : "Agent created");
      setOpen(false);
      reset();
      if (!editing && openAfterCreate) router.push(`/agents/${saved.id}`);
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit agent" : "New agent"}</DialogTitle>
          <DialogDescription>
            An agent is a saved definition: instructions, model and capabilities. Nothing is sent to a model provider in this
            phase. Changing the instructions or model creates a new version.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField id={`${uid}-agent-name`} label="Name" error={errors.name} className="sm:col-span-2">
              <Input
                id={`${uid}-agent-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="e.g. Release notes writer"
                aria-invalid={Boolean(errors.name)}
                autoFocus
                required
              />
            </FormField>
            <FormField id={`${uid}-agent-status`} label="Status" error={errors.status}>
              <OptionSelect id={`${uid}-agent-status`} value={status} options={AGENT_STATUSES} labels={AGENT_STATUS_LABELS} onChange={setStatus} />
            </FormField>
          </div>
          <FormField id={`${uid}-agent-description`} label="Purpose" error={errors.description}>
            <Input
              id={`${uid}-agent-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              placeholder="One sentence on what this agent is for"
              aria-invalid={Boolean(errors.description)}
            />
          </FormField>
          <FormField
            id={`${uid}-agent-instructions`}
            label="Instructions"
            error={errors.instructions}
            hint="The system prompt the agent will run with. Do not paste API keys or passwords here."
          >
            <Textarea
              id={`${uid}-agent-instructions`}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              maxLength={20000}
              rows={8}
              className="font-mono text-xs"
              aria-invalid={Boolean(errors.instructions)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id={`${uid}-agent-provider`}
              label="Runtime / provider"
              error={errors.provider}
              hint="Hermes Agent runs tasks with the model set up in Hermes (e.g. Gemini)."
            >
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id={`${uid}-agent-provider`} className="w-full" aria-invalid={Boolean(errors.provider)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROVIDER}>Not chosen</SelectItem>
                  {providers.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id={`${uid}-agent-model`} label="Model id (optional)" error={errors.model} hint="Falls back to the provider default.">
              <Input
                id={`${uid}-agent-model`}
                value={model}
                onChange={(event) => setModel(event.target.value)}
                maxLength={100}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                aria-invalid={Boolean(errors.model)}
              />
            </FormField>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Capabilities</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {AGENT_CAPABILITIES.map((capability) => {
                const id = `${uid}-agent-capability-${capability}`;
                return (
                  <label key={capability} htmlFor={id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={id}
                      checked={capabilities.includes(capability)}
                      onCheckedChange={(checked) => toggleCapability(capability, checked === true)}
                    />
                    {AGENT_CAPABILITY_LABELS[capability]}
                  </label>
                );
              })}
            </div>
            {errors.capabilities && <p className="text-xs text-destructive">{errors.capabilities}</p>}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Create agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
