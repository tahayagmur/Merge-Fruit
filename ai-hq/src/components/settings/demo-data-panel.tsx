"use client";

import { DatabaseZap, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { Button } from "@/components/ui/button";
import { apiRequest, errorMessage } from "@/lib/api-client";

export interface DemoCounts {
  projects: number;
  tasks: number;
  automations: number;
  agents: number;
  agentTasks: number;
  total: number;
}

const ROWS: Array<{ key: Exclude<keyof DemoCounts, "total">; label: string }> = [
  { key: "projects", label: "Projects" },
  { key: "tasks", label: "Tasks" },
  { key: "automations", label: "Automations" },
  { key: "agents", label: "Agents" },
  { key: "agentTasks", label: "Agent tasks" },
];

export function DemoDataPanel({ counts, production }: { counts: DemoCounts; production: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const loaded = counts.total > 0;

  async function load() {
    setLoading(true);
    try {
      const result = await apiRequest<DemoCounts>("/api/demo-data", { method: "POST" });
      toast.success(`Loaded ${result.total} demo records`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    try {
      await apiRequest("/api/demo-data", { method: "DELETE" });
      toast.success("Demo data removed");
      router.refresh();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ROWS.map((row) => (
          <div key={row.key} className="rounded-lg border p-3">
            <dt className="hq-label">{row.label}</dt>
            <dd className="font-mono text-lg">{counts[row.key]}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button onClick={load} disabled={loading || loaded || production}>
          {loading ? <Loader2 className="animate-spin" /> : <DatabaseZap />}
          Load demo data
        </Button>
        <ConfirmDelete
          title="Remove all demo data?"
          description={`${counts.total} demo record${counts.total === 1 ? "" : "s"} will be deleted. Records without the demo flag are not touched.`}
          confirmLabel="Remove demo data"
          onConfirm={remove}
          trigger={
            <Button variant="outline" disabled={!loaded} className="text-destructive hover:text-destructive">
              <Trash2 /> Remove demo data
            </Button>
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {production
          ? "Loading demo data is disabled in production."
          : loaded
            ? "Demo data is loaded. Remove it before loading it again."
            : "Demo records are owned by you, prefixed with [Demo] and flagged, so they never mix with real figures."}
      </p>
    </div>
  );
}
