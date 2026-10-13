import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { INTEGRATION_STATUS_LABELS, INTEGRATION_STATUS_TONE, IntegrationStatusBadge } from "@/components/common/status-badges";
import { StatusIndicator } from "@/components/common/status-indicator";
import { PageHeader } from "@/components/layout/page-header";
import { PlannedScopeCard } from "@/components/roadmap/module-roadmap";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listIntegrationViews } from "@/lib/data/integrations";
import { INTEGRATION_CATEGORIES, INTEGRATION_CATEGORY_LABELS, INTEGRATION_STATUSES } from "@/lib/integrations/types";
import { MODULE_PLANS } from "@/lib/roadmap";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="Integrations"
        description="Prepare each external service on its own: non-secret settings here, credentials as server environment variables."
      />
      <Suspense fallback={<IntegrationsSkeleton />}>
        <IntegrationsContent />
      </Suspense>
    </>
  );
}

async function IntegrationsContent() {
  const { supabase } = await requireWorkspace();
  const integrations = await listIntegrationViews(supabase);

  return (
    <div className="grid grid-cols-1 gap-8">
      <Alert variant="info">
        <ShieldCheck />
        <AlertTitle>Nothing is connected in this phase</AlertTitle>
        <AlertDescription>
          <p>
            No connector is installed yet, so no integration contacts an external system. An integration is shown as Connected
            only after its connector exists and a real connection test has passed for the current settings.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTEGRATION_STATUSES.map((status) => (
              <StatusIndicator
                key={status}
                tone={INTEGRATION_STATUS_TONE[status]}
                label={`${INTEGRATION_STATUS_LABELS[status]} · ${integrations.filter((item) => item.status === status).length}`}
              />
            ))}
          </div>
        </AlertDescription>
      </Alert>

      {INTEGRATION_CATEGORIES.map((category) => {
        const items = integrations.filter((integration) => integration.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} aria-labelledby={`integrations-${category}`} className="grid gap-3">
            <h2 id={`integrations-${category}`} className="hq-label">
              {INTEGRATION_CATEGORY_LABELS[category]}
            </h2>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((integration) => {
                const requiredSecrets = integration.secrets.filter((secret) => secret.required);
                const presentSecrets = requiredSecrets.filter((secret) => secret.present).length;
                return (
                  <li key={integration.key}>
                    <Link
                      href={`/integrations/${integration.key}`}
                      className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-accent/20 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-medium group-hover:text-primary">{integration.name}</h3>
                        <IntegrationStatusBadge status={integration.status} />
                      </div>
                      <p className="flex-1 text-sm text-muted-foreground">{integration.description}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <KeyRound className="size-3" /> Secrets {presentSecrets}/{requiredSecrets.length}
                        </span>
                        <span>{integration.enabled ? "Enabled" : "Disabled"}</span>
                        <span>Connector · Phase {integration.plannedPhase}</span>
                        <ArrowRight className="ml-auto size-3.5" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PlannedScopeCard plan={MODULE_PLANS.integrations} />
      </div>
    </div>
  );
}

function IntegrationsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}
