import { ListChecks } from "lucide-react";
import { PriorityBadge } from "@/components/common/status-badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectTemplateDefinition } from "@/lib/templates";

/** Shows a built-in checklist. It is applied from a project's page and only creates AI HQ tasks. */
export function ChecklistTemplateCard({ template, applyHint }: { template: ProjectTemplateDefinition; applyHint: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="size-4 text-primary" /> {template.name}
        </CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ol className="grid gap-2">
          {template.tasks.map((task, index) => (
            <li key={task.title} className="flex items-start justify-between gap-3 text-sm">
              <span className="flex gap-2">
                <span className="w-5 shrink-0 text-right font-mono text-xs leading-5 text-muted-foreground">{index + 1}.</span>
                <span>{task.title}</span>
              </span>
              <PriorityBadge priority={task.priority} />
            </li>
          ))}
        </ol>
        <p className="border-t pt-3 text-xs text-muted-foreground">{applyHint}</p>
      </CardContent>
    </Card>
  );
}
