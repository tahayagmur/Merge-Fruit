import {
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  CircleSlash,
  FolderKanban,
  ListTodo,
  Loader,
  Plus,
  Workflow,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { EmptyState } from "@/components/common/empty-state";
import { PriorityBadge, ProjectStatusBadge, TaskStatusBadge } from "@/components/common/status-badges";
import { StatCard } from "@/components/command-center/stat-card";
import { SystemStatus } from "@/components/command-center/system-status";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { listActivity } from "@/lib/data/activity";
import { getCommandCenterSummary } from "@/lib/data/dashboard";
import { listProjects } from "@/lib/data/projects";
import { listUpcomingTasks } from "@/lib/data/tasks";
import { getServerEnv } from "@/lib/env";
import { formatDate, isOverdue, percentage, todayUtc } from "@/lib/format";
import { getN8nStatus } from "@/lib/integrations/n8n/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Command Center" };

export default function CommandCenterPage() {
  return (
    <>
      <PageHeader
        eyebrow="Command Center"
        title="Mission overview"
        description="Projects, tasks and automations at a glance. Everything here is live data from your workspace."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/automation">
                <Workflow /> Automations
              </Link>
            </Button>
            <ProjectFormDialog
              openAfterCreate
              trigger={
                <Button>
                  <Plus /> New project
                </Button>
              }
            />
          </>
        }
      />
      <Suspense fallback={<CommandCenterSkeleton />}>
        <CommandCenterContent />
      </Suspense>
    </>
  );
}

async function CommandCenterContent() {
  const { supabase } = await requireUser();
  const [summary, upcoming, activity, projects] = await Promise.all([
    getCommandCenterSummary(supabase),
    listUpcomingTasks(supabase, 6),
    listActivity(supabase, { limit: 8 }),
    listProjects(supabase, { status: "active" }),
  ]);
  const now = new Date();
  const today = todayUtc(now);
  const env = getServerEnv();

  return (
    <div className="grid grid-cols-1 gap-6">
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active projects" value={summary.projectsActive} hint={`${summary.projectsTotal} total`} icon={FolderKanban} tone="accent" />
        <StatCard label="Open tasks" value={summary.tasksOpen} icon={ListTodo} />
        <StatCard label="In progress" value={summary.tasksInProgress} icon={Loader} tone="accent" />
        <StatCard label="Blocked" value={summary.tasksBlocked} icon={CircleSlash} tone="destructive" />
        <StatCard label="Overdue" value={summary.tasksOverdue} icon={AlertTriangle} tone="warning" />
        <StatCard label="Done · 7 days" value={summary.tasksDoneLast7Days} icon={CheckCheck} tone="success" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Upcoming tasks</CardTitle>
            <CardDescription>Open tasks across projects, soonest due first.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <EmptyState icon={ListTodo} title="No open tasks" description="Create a project and add tasks to see them here." />
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((task) => {
                  const overdue = isOverdue(task.dueDate, task.status, today);
                  return (
                    <li key={task.id}>
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/30"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{task.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{task.projectName}</p>
                        </div>
                        <span className="hidden sm:inline-flex">
                          <PriorityBadge priority={task.priority} />
                        </span>
                        <TaskStatusBadge status={task.status} />
                        <span className={cn("w-16 text-right font-mono text-xs text-muted-foreground", overdue && "text-warning")}>
                          {task.dueDate ? formatDate(task.dueDate, { short: true }) : "—"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Recorded automatically by the database.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/activity">
                  All <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {activity.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ActivityFeed entries={activity.entries} now={now} compact />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Active projects</CardTitle>
            <CardDescription>Progress by completed tasks.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">
                  All projects <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No active projects"
                description="Set a project's status to Active to track it here."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-4">
                {projects.slice(0, 5).map((project) => {
                  const progress = percentage(project.taskDone, project.taskTotal);
                  return (
                    <li key={project.id}>
                      <Link href={`/projects/${project.id}`} className="group block space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium group-hover:text-primary">{project.name}</span>
                          <span className="flex items-center gap-2">
                            <ProjectStatusBadge status={project.status} />
                            <span className="w-10 text-right font-mono text-xs text-muted-foreground">{progress}%</span>
                          </span>
                        </div>
                        <Progress value={progress} aria-label={`${project.name}: ${progress}% done`} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>System status</CardTitle>
            <CardDescription>What is connected in this phase.</CardDescription>
          </CardHeader>
          <CardContent>
            <SystemStatus appEnv={env.appEnv} n8n={getN8nStatus()} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CommandCenterSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-xl lg:col-span-3" />
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}
