"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { Button } from "@/components/ui/button";
import { apiRequest, errorMessage } from "@/lib/api-client";
import type { Agent } from "@/lib/domain";
import { AgentFormDialog, type ProviderOption } from "./agent-form-dialog";

export function AgentActions({ agent, providers, taskCount }: { agent: Agent; providers: ProviderOption[]; taskCount: number }) {
  const router = useRouter();

  async function remove() {
    try {
      await apiRequest(`/api/agents/${agent.id}`, { method: "DELETE" });
      toast.success("Agent deleted");
      router.push("/agents");
      router.refresh();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  return (
    <>
      <AgentFormDialog
        agent={agent}
        providers={providers}
        trigger={
          <Button variant="outline" size="sm">
            <Pencil /> Edit
          </Button>
        }
      />
      <ConfirmDelete
        title="Delete this agent?"
        description={`“${agent.name}” and its ${taskCount} task record${taskCount === 1 ? "" : "s"} will be permanently deleted.`}
        onConfirm={remove}
        trigger={
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 /> Delete
          </Button>
        }
      />
    </>
  );
}
