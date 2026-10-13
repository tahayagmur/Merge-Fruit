import { Bot, Info, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AgentFormDialog } from "@/components/agents/agent-form-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { FilterChips } from "@/components/common/filter-chips";
import { Pagination } from "@/components/common/pagination";
import { SearchForm } from "@/components/common/search-form";
import { AgentStatusBadge, IntegrationStatusBadge } from "@/components/common/status-badges";
import { DemoBadge } from "@/components/common/status-indicator";
import { PageHeader } from "@/components/layout/page-header";
import { PlannedScopeCard } from "@/components/roadmap/module-roadmap";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireWorkspace } from "@/lib/auth/workspace";
import { countAgentTasks, listAgents } from "@/lib/data/agents";
import { listIntegrationViews } from "@/lib/data/integrations";
import { AGENT_CAPABILITY_LABELS, AGENT_STATUS_LABELS, AGENT_STATUSES } from "@/lib/domain";
import { formatRelativeTime } from "@/lib/format";
import { MODULE_PLANS } from "@/lib/roadmap";
import { agentListQuerySchema } from "@/lib/validation/agents";

export const metadata: Metadata = { title: "AI Agent Hub" };

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default function AgentsPage(props: PageProps<"/agents">) {
  return (
    <Suspense fallback={<AgentsSkeleton />}>
      <AgentsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function AgentsContent({ searchParams }: { searchParams: PageProps<"/agents">["searchParams"] }) {
  const raw = await searchParams;
  const parsed = agentListQuerySchema.safeParse({ status: single(raw.status), q: single(raw.q), page: single(raw.page) });
  const filters = parsed.success ? parsed.data : { page: 1, q: undefined };
  const { supabase } = await requireWorkspace();
  const [result, taskCounts, integrations] = await Promise.all([
    listAgents(supabase, filters),
    countAgentTasks(supabase),
    listIntegrationViews(supabase),
  ]);
  const providers = integrations.filter((integration) => integration.category === "ai");
  const providerOptions = providers.map(({ key, name }) => ({ key, name }));
  const providerByKey = new Map(providers.map((provider) => [provider.key, provider]));
  const params = { status: filters.status, q: filters.q };
  const filtered = Boolean(filters.status || filters.q);
  const now = new Date();

  const newButton = (
    <AgentFormDialog
      providers={providerOptions}
      openAfterCreate
      trigger={
        <Button>
          <Plus /> New agent
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader eyebrow="AI Agent Hub" title="Agents" description={MODULE_PLANS.agents.summary} actions={newButton} />
      <div className="grid grid-cols-1 gap-6">
        <Alert variant="info">
          <Info />
          <AlertTitle>No agent runtime is connected</AlertTitle>
          <AlertDescription>
            <p>
              Agents are definitions and tasks are queued records. No model provider is called and no task runs in this phase.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {providers.map((provider) => (
                <Link key={provider.key} href={`/integrations/${provider.key}`} className="inline-flex items-center gap-2 hover:text-foreground">
                  <span className="text-foreground">{provider.name}</span>
                  <IntegrationStatusBadge status={provider.status} />
                </Link>
              ))}
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips
            label="Status"
            param="status"
            current={filters.status}
            basePath="/agents"
            params={params}
            options={AGENT_STATUSES.map((value) => ({ value, label: AGENT_STATUS_LABELS[value] }))}
          />
          <SearchForm basePath="/agents" params={params} defaultValue={filters.q} placeholder="Search agents" label="Search agents" />
        </div>

        {result.items.length === 0 ? (
          <EmptyState
            icon={Bot}
            title={filtered ? "No agents match" : "No agents yet"}
            description={
              filtered ? "Try another filter or search term." : "Define an agent with its instructions, model and capabilities."
            }
            action={!filtered ? newButton : undefined}
          />
        ) : (
          <>
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Provider</TableHead>
                    <TableHead className="hidden lg:table-cell">Capabilities</TableHead>
                    <TableHead className="text-right">Queued</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((agent) => {
                    const provider = agent.provider ? providerByKey.get(agent.provider) : undefined;
                    const counts = taskCounts.get(agent.id) ?? {};
                    return (
                      <TableRow key={agent.id}>
                        <TableCell className="max-w-72">
                          <Link href={`/agents/${agent.id}`} className="group grid gap-0.5">
                            <span className="flex items-center gap-2 font-medium group-hover:text-primary">
                              <span className="truncate">{agent.name}</span>
                              {agent.isDemo && <DemoBadge />}
                              <span className="font-mono text-xs text-muted-foreground">v{agent.version}</span>
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{agent.description || "No description"}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <AgentStatusBadge status={agent.status} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {provider ? (
                            <span className="grid gap-1 text-xs">
                              <span>{provider.name}</span>
                              {agent.model && <span className="font-mono text-muted-foreground">{agent.model}</span>}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not chosen</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden max-w-64 lg:table-cell">
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {agent.capabilities.length
                              ? agent.capabilities.map((capability) => AGENT_CAPABILITY_LABELS[capability]).join(", ")
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{counts.queued ?? 0}</TableCell>
                        <TableCell className="hidden text-right text-xs text-muted-foreground sm:table-cell">
                          {formatRelativeTime(agent.updatedAt, now)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Pagination page={result.page} pageSize={result.pageSize} total={result.total} params={params} basePath="/agents" label="agents" />
          </>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PlannedScopeCard plan={MODULE_PLANS.agents} />
        </div>
      </div>
    </>
  );
}

function AgentsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
