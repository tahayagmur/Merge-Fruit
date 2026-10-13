import { Info, Plus, Workflow } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutomationFormDialog } from "@/components/automations/automation-form-dialog";
import { AutomationList } from "@/components/automations/automation-list";
import { StatCard } from "@/components/command-center/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { FilterChips } from "@/components/common/filter-chips";
import { Pagination } from "@/components/common/pagination";
import { SearchForm } from "@/components/common/search-form";
import { IntegrationStatusBadge } from "@/components/common/status-badges";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireWorkspace } from "@/lib/auth/workspace";
import { countAutomationsByStatus, listAutomations } from "@/lib/data/automations";
import { listIntegrationViews } from "@/lib/data/integrations";
import { listProjectOptions } from "@/lib/data/projects";
import { AUTOMATION_STATUS_LABELS, AUTOMATION_STATUSES } from "@/lib/domain";
import { automationListQuerySchema } from "@/lib/validation/automations";

export const metadata: Metadata = { title: "Automation Center" };

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default function AutomationCenterPage(props: PageProps<"/automation">) {
  return (
    <Suspense fallback={<AutomationSkeleton />}>
      <AutomationContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function AutomationContent({ searchParams }: { searchParams: PageProps<"/automation">["searchParams"] }) {
  const raw = await searchParams;
  const parsed = automationListQuerySchema.safeParse({
    status: single(raw.status),
    q: single(raw.q),
    page: single(raw.page),
  });
  const filters = parsed.success ? parsed.data : { page: 1, q: undefined };
  const { supabase } = await requireWorkspace();
  const [result, counts, projects, integrations] = await Promise.all([
    listAutomations(supabase, filters),
    countAutomationsByStatus(supabase),
    listProjectOptions(supabase),
    listIntegrationViews(supabase),
  ]);
  const engines = integrations.filter((item) => item.category === "automation" && item.key !== "webhooks");
  const engineOptions = engines.map(({ key, name }) => ({ key, name }));
  const projectOptions = projects.map(({ id, name }) => ({ id, name }));
  const params = { status: filters.status, q: filters.q };

  const newButton = (
    <AutomationFormDialog
      projects={projectOptions}
      engines={engineOptions}
      trigger={
        <Button>
          <Plus /> New automation
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader
        eyebrow="Automation Center"
        title="Automations"
        description="Catalogue the automations you already run. Each entry can reference a workflow in an engine such as n8n; AI HQ never creates or edits workflows."
        actions={newButton}
      />

      <div className="grid grid-cols-1 gap-6">
        <Alert variant="info">
          <Info />
          <AlertTitle>No workflow engine is connected</AlertTitle>
          <AlertDescription>
            <p>
              Nothing on this page triggers a workflow. Engines are linked through their connector in a later phase.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {engines.map((engine) => (
                <Link key={engine.key} href={`/integrations/${engine.key}`} className="inline-flex items-center gap-2 hover:text-foreground">
                  <span className="text-foreground">{engine.name}</span>
                  <IntegrationStatusBadge status={engine.status} />
                </Link>
              ))}
            </div>
          </AlertDescription>
        </Alert>

        <section aria-label="Automation figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={counts.total ?? 0} icon={Workflow} tone="accent" />
          <StatCard label="Draft" value={counts.draft ?? 0} icon={Workflow} />
          <StatCard label="Ready to link" value={counts.ready ?? 0} icon={Workflow} tone="accent" />
          <StatCard label="Paused" value={counts.paused ?? 0} icon={Workflow} />
        </section>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips
            label="Status"
            param="status"
            current={filters.status}
            basePath="/automation"
            params={params}
            options={AUTOMATION_STATUSES.map((value) => ({ value, label: AUTOMATION_STATUS_LABELS[value] }))}
          />
          <SearchForm basePath="/automation" params={params} defaultValue={filters.q} placeholder="Search automations" label="Search automations" />
        </div>

        {result.items.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title={filters.status || filters.q ? "No automations match" : "No automations yet"}
            description="Add the automations you already run — purpose, trigger and the project they belong to."
            action={!filters.status && !filters.q ? newButton : undefined}
          />
        ) : (
          <>
            <AutomationList automations={result.items} projects={projectOptions} engines={engineOptions} />
            <Pagination
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              params={params}
              basePath="/automation"
              label="automations"
            />
          </>
        )}
      </div>
    </>
  );
}

function AutomationSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 pt-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-16 w-1/2" />
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
