"use client";

import { Ban, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { Button } from "@/components/ui/button";
import { apiRequest, errorMessage } from "@/lib/api-client";
import type { AgentTask } from "@/lib/domain";

export function AgentTaskActions({ task }: { task: AgentTask }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  async function cancel() {
    setCancelling(true);
    try {
      await apiRequest(`/api/agent-tasks/${task.id}`, { method: "PATCH", body: { status: "cancelled" } });
      toast.success("Task cancelled");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setCancelling(false);
    }
  }

  async function remove() {
    try {
      await apiRequest(`/api/agent-tasks/${task.id}`, { method: "DELETE" });
      toast.success("Task deleted");
      router.refresh();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  return (
    <div className="flex justify-end gap-1">
      {task.status === "queued" && (
        <Button variant="ghost" size="sm" onClick={cancel} disabled={cancelling} aria-label={`Cancel ${task.title}`}>
          {cancelling ? <Loader2 className="animate-spin" /> : <Ban />}
          Cancel
        </Button>
      )}
      <ConfirmDelete
        title="Delete this task record?"
        description={`“${task.title}” will be permanently deleted.`}
        onConfirm={remove}
        trigger={
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${task.title}`}>
            <Trash2 />
          </Button>
        }
      />
    </div>
  );
}
