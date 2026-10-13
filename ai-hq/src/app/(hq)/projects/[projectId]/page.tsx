import { ArrowLeft, CalendarDays, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { CategoryBadge, PriorityBadge, ProjectStatusBadge } from "@/components/common/status-badges";
import { DemoBadge } from "@/components/common/status-indicator";
import { ApplyTemplateButton } from "@/components/projects/apply-template-button";
import { ProjectActions } from "@/components/projects/project-actions";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listProjectActivity } from "@/lib/data/activity";
import { getProject } from "@/lib/data/projects";
import { listTasks } from "@/lib/data/tasks";
import { formatDate, isOverdue, percentage, todayInTimeZone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { idSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Project" };

export default function ProjectPage(props: PageProps<"/projects/[projectId]">) {
  return (
    <>
      <div className="pt-6">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href="/projects">
            <ArrowLeft /> Projects
          </Link>
        </Button>
      </div>
      <Suspense fallback={<ProjectSkeleton />}>
        <ProjectContent params={props.params} />
      </Suspense>
    </>
  );
}

async function ProjectContent({ params }: { params: PageProps<"/projects/[projectId]">["params"] }) {
  const { projectId } = await params;
  if (!idSchema.safeParse(projectId).success) notFound();

  const { supabase, settings } = await requireWorkspace();
  const project = await getProject(supabase, projectId);
  if (!project) notFound();

  const [tasks, activity] = await Promise.all([
    listTasks(supabase, project.id),
    listProjectActivity(supabase, project.id, 15),
  ]);
  const now = new Date();
  const today = todayInTimeZone(settings.timezone, now);
  const progress = percentage(project.taskDone, project.taskTotal);
  const overdue = isOverdue(project.dueDate, project.status, today);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-col gap-4 pt-4 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <CategoryBadge category={project.category} />
            <PriorityBadge priority={project.priority} />
            {project.isDemo && <DemoBadge />}
            {project.dueDate && (
              <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", overdue && "text-warning")}>
                <CalendarDays className="size-3" /> Due {formatDate(project.dueDate)}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
          {project.description && (
            <p className="max-w-3xl text-sm whitespace-pre-line text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {project.category === "game" && (
            <ApplyTemplateButton projectId={project.id} template="game_release" label="Add release checklist" />
          )}
          {project.category === "saas" && (
            <ApplyTemplateButton projectId={project.id} template="saas_launch" label="Add launch checklist" />
          )}
          <ProjectActions project={project} taskCount={project.taskTotal} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 sm:col-span-2">
          <div className="flex items-center justify-between text-sm">
            <span className="hq-label">Progress</span>
            <span className="font-mono text-muted-foreground">
              {project.taskDone}/{project.taskTotal} · {progress}%
            </span>
          </div>
          <Progress value={progress} className="mt-3" aria-label={`${progress}% of tasks done`} />
        </div>
        <div className="flex items-center justify-around rounded-xl border bg-card p-4 text-center">
          <div>
            <p className="font-mono text-xl font-semibold text-destructive">{project.taskBlocked}</p>
            <p className="hq-label">Blocked</p>
          </div>
          <div>
            <p className="font-mono text-xl font-semibold text-warning">{project.taskOverdue}</p>
            <p className="hq-label">Overdue</p>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4" aria-labelledby="tasks-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="tasks-heading" className="text-lg font-semibold">
            Tasks
          </h2>
          <div className="flex gap-2 sm:w-[28rem]">
            <div className="flex-1">
              <QuickAddTask projectId={project.id} />
            </div>
            <TaskFormDialog
              projectId={project.id}
              trigger={
                <Button variant="outline" aria-label="New task with details">
                  <Plus /> Details
                </Button>
              }
            />
          </div>
        </div>
        <TaskBoard tasks={tasks} projectId={project.id} today={today} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Project activity</CardTitle>
          <CardDescription>Changes to this project and its tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ActivityFeed entries={activity} now={now} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 pt-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
