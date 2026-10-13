"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { Button } from "@/components/ui/button";
import { apiRequest, errorMessage } from "@/lib/api-client";
import type { Project } from "@/lib/domain";
import { ProjectFormDialog } from "./project-form-dialog";

export function ProjectActions({ project, taskCount }: { project: Project; taskCount: number }) {
  const router = useRouter();

  async function remove() {
    try {
      await apiRequest(`/api/projects/${project.id}`, { method: "DELETE" });
      toast.success("Project deleted");
      router.push("/projects");
      router.refresh();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  return (
    <>
      <ProjectFormDialog
        project={project}
        trigger={
          <Button variant="outline" size="sm">
            <Pencil /> Edit
          </Button>
        }
      />
      <ConfirmDelete
        title="Delete this project?"
        description={`“${project.name}” and its ${taskCount} task${taskCount === 1 ? "" : "s"} will be permanently deleted. Linked automations are kept but unlinked.`}
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
