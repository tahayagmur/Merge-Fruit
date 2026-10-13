import { AlertTriangle, CalendarDays, CircleSlash } from "lucide-react";
import Link from "next/link";
import { CategoryBadge, PriorityBadge, ProjectStatusBadge } from "@/components/common/status-badges";
import { Progress } from "@/components/ui/progress";
import type { ProjectSummary } from "@/lib/domain";
import { formatDate, isOverdue, percentage } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProjectCard({ project, today }: { project: ProjectSummary; today: string }) {
  const progress = percentage(project.taskDone, project.taskTotal);
  const overdue = isOverdue(project.dueDate, project.status, today);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-accent/20 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate font-medium group-hover:text-primary">{project.name}</h3>
          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
            {project.description || "No description"}
          </p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {project.taskDone}/{project.taskTotal} tasks done
          </span>
          <span className="font-mono">{progress}%</span>
        </div>
        <Progress value={progress} aria-label={`${progress}% of tasks done`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <CategoryBadge category={project.category} />
        <PriorityBadge priority={project.priority} />
        {project.taskBlocked > 0 && (
          <span className="inline-flex items-center gap-1 text-destructive">
            <CircleSlash className="size-3" /> {project.taskBlocked} blocked
          </span>
        )}
        {project.taskOverdue > 0 && (
          <span className="inline-flex items-center gap-1 text-warning">
            <AlertTriangle className="size-3" /> {project.taskOverdue} overdue
          </span>
        )}
        {project.dueDate && (
          <span className={cn("ml-auto inline-flex items-center gap-1", overdue && "text-warning")}>
            <CalendarDays className="size-3" /> {formatDate(project.dueDate, { short: true })}
          </span>
        )}
      </div>
    </Link>
  );
}
