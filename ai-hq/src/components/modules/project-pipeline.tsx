import { AlertTriangle, CircleSlash } from "lucide-react";
import Link from "next/link";
import { DemoBadge } from "@/components/common/status-indicator";
import { Progress } from "@/components/ui/progress";
import { PROJECT_STATUS_LABELS, type ProjectStatus, type ProjectSummary } from "@/lib/domain";
import { formatDate, isOverdue, percentage } from "@/lib/format";
import { cn } from "@/lib/utils";

const PIPELINE: ProjectStatus[] = ["planning", "active", "on_hold", "completed"];

/** Projects of one category laid out as a status pipeline. Archived projects are left out. */
export function ProjectPipeline({ projects, today }: { projects: ProjectSummary[]; today: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {PIPELINE.map((status) => {
        const items = projects.filter((project) => project.status === status);
        return (
          <section key={status} aria-label={PROJECT_STATUS_LABELS[status]} className="flex flex-col gap-3 rounded-xl border bg-card/50 p-3">
            <header className="flex items-center justify-between px-1">
              <h3 className="hq-label">{PROJECT_STATUS_LABELS[status]}</h3>
              <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
            </header>
            {items.length === 0 ? (
              <p className="px-1 pb-2 text-xs text-muted-foreground">Nothing here.</p>
            ) : (
              <ul className="grid gap-2">
                {items.map((project) => {
                  const progress = percentage(project.taskDone, project.taskTotal);
                  const overdue = isOverdue(project.dueDate, project.status, today);
                  return (
                    <li key={project.id}>
                      <Link
                        href={`/projects/${project.id}`}
                        className="group grid gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-primary/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium group-hover:text-primary">
                          <span className="truncate">{project.name}</span>
                          {project.isDemo && <DemoBadge />}
                        </span>
                        <Progress value={progress} aria-label={`${project.name}: ${progress}% done`} />
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-mono">
                            {project.taskDone}/{project.taskTotal}
                          </span>
                          {project.taskBlocked > 0 && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <CircleSlash className="size-3" /> {project.taskBlocked}
                            </span>
                          )}
                          {project.taskOverdue > 0 && (
                            <span className="inline-flex items-center gap-1 text-warning">
                              <AlertTriangle className="size-3" /> {project.taskOverdue}
                            </span>
                          )}
                          {project.dueDate && (
                            <span className={cn("ml-auto font-mono", overdue && "text-warning")}>
                              {formatDate(project.dueDate, { short: true })}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
