import { Briefcase, Plus, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { IntegrationStatusBadge } from "@/components/common/status-badges";
import { PageHeader } from "@/components/layout/page-header";
import { ChecklistTemplateCard } from "@/components/modules/checklist-template-card";
import { IntegrationStatusList } from "@/components/modules/integration-status-list";
import { ProjectPipeline } from "@/components/modules/project-pipeline";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { PlannedScopeCard } from "@/components/roadmap/module-roadmap";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listIntegrationViews } from "@/lib/data/integrations";
import { listProjects } from "@/lib/data/projects";
import { todayInTimeZone } from "@/lib/format";
import { MODULE_PLANS } from "@/lib/roadmap";
import { PROJECT_TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = { title: "SaaS & Business" };

const PIPELINE_LIMIT = 100;

export default function SaasPage() {
  return (
    <>
      <PageHeader
        eyebrow="SaaS & Business"
        title="SaaS & Business"
        description={MODULE_PLANS.saas.summary}
        actions={
          <ProjectFormDialog
            openAfterCreate
            defaultCategory="saas"
            trigger={
              <Button>
                <Plus /> New SaaS project
              </Button>
            }
          />
        }
      />
      <Suspense fallback={<SaasSkeleton />}>
        <SaasContent />
      </Suspense>
    </>
  );
}

async function SaasContent() {
  const { supabase, settings } = await requireWorkspace();
  const [projects, integrations] = await Promise.all([
    listProjects(supabase, { category: "saas", pageSize: PIPELINE_LIMIT }),
    listIntegrationViews(supabase),
  ]);
  const today = todayInTimeZone(settings.timezone);
  const business = integrations.filter((integration) => integration.category === "business");
  const revenueSource = business.find((integration) => integration.status === "connected");

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" /> Revenue & customers
          </CardTitle>
          <CardDescription>MRR, churn and customer figures come only from a connected, read-only data source.</CardDescription>
          <CardAction className="flex items-center gap-2">
            {business.map((integration) => (
              <IntegrationStatusBadge key={integration.key} status={integration.status} />
            ))}
          </CardAction>
        </CardHeader>
        <CardContent>
          {revenueSource ? (
            <p className="text-sm text-muted-foreground">{revenueSource.name} is connected. Figures arrive with the Phase 6 reports.</p>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-6 text-center sm:items-center">
              <p className="text-sm font-medium">No revenue data source connected</p>
              <p className="max-w-lg text-sm text-muted-foreground">
                AI HQ shows no revenue numbers until a payment provider is connected and its connection test passes. Nothing here
                is estimated or sample data.
              </p>
              <div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/integrations/stripe">View Stripe integration</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="saas-pipeline" className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="saas-pipeline" className="text-base font-semibold">
              Products
            </h2>
            <p className="text-sm text-muted-foreground">SaaS projects by status. Open a project to manage its tasks.</p>
          </div>
          <Link href="/projects?category=saas" className="text-xs text-primary hover:underline">
            {projects.total} SaaS project{projects.total === 1 ? "" : "s"} in Projects
          </Link>
        </div>
        {projects.total === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No SaaS projects yet"
            description="Create a project with the SaaS & Business category to see it here."
            action={
              <ProjectFormDialog
                openAfterCreate
                defaultCategory="saas"
                trigger={
                  <Button size="sm">
                    <Plus /> New SaaS project
                  </Button>
                }
              />
            }
          />
        ) : (
          <>
            <ProjectPipeline projects={projects.items} today={today} />
            {projects.total > projects.items.length && (
              <p className="text-xs text-muted-foreground">
                Showing the {projects.items.length} most recently updated projects.{" "}
                <Link href="/projects?category=saas" className="text-primary hover:underline">
                  See all
                </Link>
              </p>
            )}
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChecklistTemplateCard
          template={PROJECT_TEMPLATES.saas_launch}
          applyHint="Open a SaaS project and choose “Add launch checklist” to copy these steps into it as tasks."
        />
        <div className="grid grid-cols-1 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Business data sources</CardTitle>
              <CardDescription>Configuration status only. No payment provider is contacted in this phase.</CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationStatusList integrations={business} />
            </CardContent>
          </Card>
          <PlannedScopeCard plan={MODULE_PLANS.saas} />
        </div>
      </div>
    </div>
  );
}

function SaasSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
