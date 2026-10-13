import {
  AlertTriangle,
  ArrowRight,
  Bot,
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
import { DemoToggle } from "@/components/command-center/demo-toggle";
import { StatCard } from "@/components/command-center/stat-card";
import { SystemStatus } from "@/components/command-center/system-status";
import { EmptyState } from "@/components/common/empty-state";
import { PriorityBadge, ProjectStatusBadge, TaskStatusBadge } from "@/components/common/status-badges";
import { DemoBadge } from "@/components/common/status-indicator";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listActivity } from "@/lib/data/activity";
import { listQueuedAgentTasks } from "@/lib/data/agents";
import { getCommandCenterSummary } from "@/lib/data/dashboard";
import { listIntegrationViews } from "@/lib/data/integrations";
import { listProjects } from "@/lib/data/projects";
import { listUpcomingTasks } from "@/lib/data/tasks";
import { getServerEnv } from "@/lib/env";
import { formatDate, formatRelativeTime, isOverdue, percentage } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Command Center" };

export default function CommandCenterPage(props: PageProps<"/">) {
  return (
    <>
      <PageHeader
        eyebrow="Command Center"
        title="Mission overview"
        description="Live figures from your workspace. Demo data is kept out of the numbers unless you include it."
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
        <CommandCenterContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function CommandCenterContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  const includeDemo = params.demo === "include";
  const { supabase, settings } = await requireWorkspace();
  const [summary, upcoming, activity, projects, queued, integrations] = await Promise.all([
    getCommandCenterSummary(supabase, { includeDemo }),
    listUpcomingTasks(supabase, { limit: 6, includeDemo }),
    listActivity(supabase, { limit: 8 }),
    listProjects(supabase, { status: "active", pageSize: 5, includeDemo }),
    listQueuedAgentTasks(supabase, { limit: 4, includeDemo }),
    listIntegrationViews(supabase),
  ]);
  const now = new Date();
  const env = getServerEnv();

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Today is <span className="font-mono text-foreground">{formatDate(summary.today)}</span> in {settings.timezone}.
        </p>
        <DemoToggle included={includeDemo} demoRecords={summary.demoRecords} />
      </div>

      {includeDemo && (
        <Alert variant="warning">
          <AlertDescription>
            <p>Figures below include demo records. Turn the toggle off to see your real data only.</p>
          </AlertDescription>
        </Alert>
      )}

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Active projects" value={summary.projectsActive} hint={`${summary.projectsTotal} total`} icon={FolderKanban} tone="accent" />
        <StatCard label="Open tasks" value={summary.tasksOpen} icon={ListTodo} />
        <StatCard label="In progress" value={summary.tasksInProgress} icon={Loader} tone="accent" />
        <StatCard label="Blocked" value={summary.tasksBlocked} icon={CircleSlash} tone="destructive" />
        <StatCard label="Overdue" value={summary.tasksOverdue} icon={AlertTriangle} tone="warning" />
        <StatCard label="Done · 7 days" value={summary.tasksDoneLast7Days} icon={CheckCheck} tone="success" />
        <StatCard label="Agent queue" value={summary.agentTasksQueued} hint={`${summary.agentsReady}/${summary.agentsTotal} agents ready`} icon={Bot} />
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
                  const overdue = isOverdue(task.dueDate, task.status, summary.today);
                  return (
                    <li key={task.id}>
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/30"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 truncate text-sm font-medium">
                            <span className="truncate">{task.title}</span>
                            {task.isDemo && <DemoBadge />}
                          </p>
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
            {projects.items.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No active projects"
                description="Set a project's status to Active to track it here."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-4">
                {projects.items.map((project) => {
                  const progress = percentage(project.taskDone, project.taskTotal);
                  return (
                    <li key={project.id}>
                      <Link href={`/projects/${project.id}`} className="group block space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-medium group-hover:text-primary">{project.name}</span>
                            {project.isDemo && <DemoBadge />}
                          </span>
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

        <div className="grid grid-cols-1 gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Agent queue</CardTitle>
              <CardDescription>Queued tasks wait until an agent runtime is connected.</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/agents">
                    Agents <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {queued.length === 0 ? (
                <p className="text-sm text-muted-foreground">No queued agent tasks.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {queued.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <Link href={`/agents/${task.agentId}`} className="min-w-0 hover:text-primary">
                        <p className="flex items-center gap-2 truncate text-sm">
                          <span className="truncate">{task.title}</span>
                          {task.isDemo && <DemoBadge />}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{task.agentName}</p>
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(task.createdAt, now)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System status</CardTitle>
              <CardDescription>What is connected in this phase.</CardDescription>
            </CardHeader>
            <CardContent>
              <SystemStatus appEnv={env.appEnv} timezone={settings.timezone} integrations={integrations} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CommandCenterSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => (
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
