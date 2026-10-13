import { Info, Plus, Workflow } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutomationFormDialog } from "@/components/automations/automation-form-dialog";
import { AutomationList } from "@/components/automations/automation-list";
import { EmptyState } from "@/components/common/empty-state";
import { StatCard } from "@/components/command-center/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { listAutomations } from "@/lib/data/automations";
import { listProjectOptions } from "@/lib/data/projects";
import { getN8nStatus } from "@/lib/integrations/n8n/service";

export const metadata: Metadata = { title: "Automation Center" };

export default function AutomationCenterPage() {
  return (
    <Suspense fallback={<AutomationSkeleton />}>
      <AutomationContent />
    </Suspense>
  );
}

async function AutomationContent() {
  const { supabase } = await requireUser();
  const [automations, projects] = await Promise.all([listAutomations(supabase), listProjectOptions(supabase)]);
  const n8n = getN8nStatus();
  const projectOptions = projects.map(({ id, name }) => ({ id, name }));
  const count = (status: string) => automations.filter((automation) => automation.status === status).length;

  const newButton = (
    <AutomationFormDialog
      projects={projectOptions}
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
        description="Catalogue the automations you run in n8n. In Phase 2 each entry is linked to your existing workflow — AI HQ never creates or edits workflows."
        actions={newButton}
      />

      <div className="grid grid-cols-1 gap-6">
        <Alert variant="info">
          <Info />
          <AlertTitle>n8n Cloud is not connected</AlertTitle>
          <AlertDescription>
            <p>
              {n8n.message} Nothing on this page triggers a workflow.{" "}
              <Link href="/integrations" className="text-primary hover:underline">
                See the integration plan
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>

        <section aria-label="Automation figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={automations.length} icon={Workflow} tone="accent" />
          <StatCard label="Draft" value={count("draft")} icon={Workflow} />
          <StatCard label="Ready for n8n" value={count("ready")} icon={Workflow} tone="accent" />
          <StatCard label="Paused" value={count("paused")} icon={Workflow} />
        </section>

        {automations.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="No automations yet"
            description="Add the automations you already run in n8n — purpose, trigger and the project they belong to."
            action={newButton}
          />
        ) : (
          <AutomationList automations={automations} projects={projectOptions} />
        )}
      </div>
    </>
  );
}

function AutomationSkeleton() {
  return (
    <div className="grid gap-6 pt-8" aria-busy="true" aria-label="Loading">
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
