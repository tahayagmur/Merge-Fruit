import { ArrowLeft, Info, ListPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AgentActions } from "@/components/agents/agent-actions";
import { AgentTaskActions } from "@/components/agents/agent-task-actions";
import { AgentTaskDialog } from "@/components/agents/agent-task-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { AgentStatusBadge, AgentTaskStatusBadge, IntegrationStatusBadge } from "@/components/common/status-badges";
import { DemoBadge } from "@/components/common/status-indicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getAgent, listAgentTasks } from "@/lib/data/agents";
import { listIntegrationViews } from "@/lib/data/integrations";
import { listProjectOptions } from "@/lib/data/projects";
import { AGENT_CAPABILITY_LABELS } from "@/lib/domain";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { idSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Agent" };

const TASK_LIMIT = 50;

export default function AgentPage(props: PageProps<"/agents/[agentId]">) {
  return (
    <>
      <div className="pt-6">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href="/agents">
            <ArrowLeft /> Agents
          </Link>
        </Button>
      </div>
      <Suspense fallback={<AgentSkeleton />}>
        <AgentContent params={props.params} />
      </Suspense>
    </>
  );
}

async function AgentContent({ params }: { params: PageProps<"/agents/[agentId]">["params"] }) {
  const { agentId } = await params;
  if (!idSchema.safeParse(agentId).success) notFound();

  const { supabase, settings } = await requireWorkspace();
  const agent = await getAgent(supabase, agentId);
  if (!agent) notFound();

  const [tasks, projects, integrations] = await Promise.all([
    listAgentTasks(supabase, agent.id, TASK_LIMIT),
    listProjectOptions(supabase),
    listIntegrationViews(supabase),
  ]);
  const providers = integrations.filter((integration) => integration.category === "ai");
  const provider = agent.provider ? providers.find((item) => item.key === agent.provider) : undefined;
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const projectOptions = projects.map(({ id, name }) => ({ id, name }));
  const now = new Date();
  const canQueue = agent.status === "ready";

  return (
    <div className="grid grid-cols-1 gap-6 pt-2 pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <AgentStatusBadge status={agent.status} />
            {agent.isDemo && <DemoBadge />}
            <span className="font-mono text-xs text-muted-foreground">version {agent.version}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{agent.name}</h1>
          {agent.description && <p className="max-w-3xl text-sm text-muted-foreground">{agent.description}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <AgentActions agent={agent} providers={providers.map(({ key, name }) => ({ key, name }))} taskCount={tasks.length} />
        </div>
      </div>

      <Alert variant="info">
        <Info />
        <AlertDescription>
          <p>
            No agent runtime is connected. Queued tasks stay queued until the runtime arrives (Phase 4); nothing is sent to a
            model provider.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
            <CardDescription>Saved with version {agent.version}. Tasks record the version they were queued with.</CardDescription>
          </CardHeader>
          <CardContent>
            {agent.instructions ? (
              <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {agent.instructions}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">No instructions yet. Edit the agent to add them.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm">
              <div className="grid gap-1">
                <dt className="hq-label">Model provider</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  {provider ? (
                    <>
                      <Link href={`/integrations/${provider.key}`} className="hover:text-primary">
                        {provider.name}
                      </Link>
                      <IntegrationStatusBadge status={provider.status} />
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not chosen</span>
                  )}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="hq-label">Model</dt>
                <dd className="font-mono text-xs">{agent.model ?? <span className="font-sans text-muted-foreground">Provider default</span>}</dd>
              </div>
              <div className="grid gap-1">
                <dt className="hq-label">Capabilities</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {agent.capabilities.length === 0 ? (
                    <span className="text-muted-foreground">None selected</span>
                  ) : (
                    agent.capabilities.map((capability) => (
                      <span key={capability} className="rounded-md border px-2 py-0.5 text-xs">
                        {AGENT_CAPABILITY_LABELS[capability]}
                      </span>
                    ))
                  )}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="hq-label">Updated</dt>
                <dd className="text-xs text-muted-foreground">{formatDateTime(agent.updatedAt, settings.timezone)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task queue</CardTitle>
          <CardDescription>
            {canQueue
              ? "Queued tasks can be cancelled until a runtime picks them up."
              : "Set the agent to Ready to queue tasks."}
          </CardDescription>
          <CardAction>
            {canQueue ? (
              <AgentTaskDialog
                agentId={agent.id}
                projects={projectOptions}
                trigger={
                  <Button size="sm">
                    <ListPlus /> Queue task
                  </Button>
                }
              />
            ) : (
              <Button size="sm" disabled title="The agent must be Ready to accept tasks.">
                <ListPlus /> Queue task
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <EmptyState icon={ListPlus} title="No tasks" description="Tasks you queue for this agent appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Project</TableHead>
                  <TableHead className="hidden sm:table-cell">Version</TableHead>
                  <TableHead className="hidden sm:table-cell">Created</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="max-w-80">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="truncate">{task.title}</span>
                        {task.isDemo && <DemoBadge />}
                      </span>
                      {task.input && <span className="line-clamp-1 text-xs text-muted-foreground">{task.input}</span>}
                    </TableCell>
                    <TableCell>
                      <AgentTaskStatusBadge status={task.status} />
                    </TableCell>
                    <TableCell className="hidden text-xs md:table-cell">
                      {task.projectId ? (
                        <Link href={`/projects/${task.projectId}`} className="hover:text-primary">
                          {projectNames.get(task.projectId) ?? "Project"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">v{task.agentVersion}</TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {formatRelativeTime(task.createdAt, now)}
                    </TableCell>
                    <TableCell>
                      <AgentTaskActions task={task} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tasks.length === TASK_LIMIT && (
            <p className="pt-3 text-xs text-muted-foreground">Showing the {TASK_LIMIT} most recent tasks.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 pt-2" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
