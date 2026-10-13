"use client";

import { FolderKanban, MoreHorizontal, Pencil, PlugZap, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { OptionSelect } from "@/components/common/option-select";
import { DemoBadge } from "@/components/common/status-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, errorMessage } from "@/lib/api-client";
import {
  type Automation,
  AUTOMATION_STATUS_LABELS,
  AUTOMATION_STATUSES,
  AUTOMATION_TRIGGER_LABELS,
  type AutomationStatus,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { AutomationFormDialog, type EngineOption, type ProjectOption } from "./automation-form-dialog";

function AutomationRow({
  automation,
  projects,
  engines,
}: {
  automation: Automation;
  projects: ProjectOption[];
  engines: EngineOption[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AutomationStatus>(automation.status);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const project = projects.find((candidate) => candidate.id === automation.projectId);
  const engine = engines.find((candidate) => candidate.key === automation.provider);

  async function changeStatus(next: AutomationStatus) {
    const previous = status;
    setStatus(next);
    setSaving(true);
    try {
      await apiRequest(`/api/automations/${automation.id}`, { method: "PATCH", body: { status: next } });
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
      await apiRequest(`/api/automations/${automation.id}`, { method: "DELETE" });
      toast.success("Automation deleted");
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
        "grid gap-4 rounded-xl border bg-card p-4 transition-opacity md:grid-cols-[1fr_auto] md:items-center",
        (saving || refreshing) && "opacity-70",
      )}
      data-testid="automation-row"
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{automation.name}</h3>
          {automation.isDemo && <DemoBadge />}
          <Badge variant="muted">{AUTOMATION_TRIGGER_LABELS[automation.triggerType]}</Badge>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <PlugZap /> Not running — no connector yet
          </Badge>
        </div>
        {automation.description && <p className="line-clamp-2 text-sm text-muted-foreground">{automation.description}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {automation.triggerNotes && <span>Trigger: {automation.triggerNotes}</span>}
          {project && (
            <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1 hover:text-primary">
              <FolderKanban className="size-3" /> {project.name}
            </Link>
          )}
          {automation.externalWorkflowId && (
            <span>
              {engine?.name ?? automation.provider} workflow:{" "}
              <code className="font-mono text-foreground/80">{automation.externalWorkflowId}</code>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <OptionSelect
          id={`automation-status-${automation.id}`}
          aria-label={`Status of ${automation.name}`}
          size="sm"
          className="w-40"
          value={status}
          options={AUTOMATION_STATUSES}
          labels={AUTOMATION_STATUS_LABELS}
          onChange={changeStatus}
          disabled={saving}
        />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${automation.name}`}>
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
        <AutomationFormDialog
          automation={automation}
          projects={projects}
          engines={engines}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
        <ConfirmDelete
          title="Delete this automation?"
          description={`“${automation.name}” will be permanently deleted. Workflows in the engine itself are not affected.`}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirm={remove}
        />
      </div>
    </li>
  );
}

export function AutomationList({
  automations,
  projects,
  engines,
}: {
  automations: Automation[];
  projects: ProjectOption[];
  engines: EngineOption[];
}) {
  return (
    <ul className="grid grid-cols-1 gap-3">
      {automations.map((automation) => (
        <AutomationRow
          key={`${automation.id}-${automation.updatedAt}`}
          automation={automation}
          projects={projects}
          engines={engines}
        />
      ))}
    </ul>
  );
}
