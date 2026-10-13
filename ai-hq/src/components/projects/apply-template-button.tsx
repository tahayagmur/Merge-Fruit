"use client";

import { ListChecks, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiRequest, errorMessage } from "@/lib/api-client";
import type { ProjectTemplate } from "@/lib/validation/projects";

/** Adds a built-in checklist to a project. Existing tasks with the same title are kept. */
export function ApplyTemplateButton({
  projectId,
  template,
  label,
  variant = "outline",
}: {
  projectId: string;
  template: ProjectTemplate;
  label: string;
  variant?: "outline" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function apply() {
    setPending(true);
    try {
      const result = await apiRequest<{ created: number; skipped: number }>(`/api/projects/${projectId}/template`, {
        method: "POST",
        body: { template },
      });
      toast.success(
        result.created > 0
          ? `Added ${result.created} task${result.created === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} already present)` : ""}`
          : "Checklist already applied",
      );
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant={variant} size="sm" onClick={apply} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <ListChecks />}
      {label}
    </Button>
  );
}
