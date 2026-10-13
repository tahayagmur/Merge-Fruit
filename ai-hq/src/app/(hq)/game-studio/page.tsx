import { Gamepad2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ChecklistTemplateCard } from "@/components/modules/checklist-template-card";
import { IntegrationStatusList } from "@/components/modules/integration-status-list";
import { ProjectPipeline } from "@/components/modules/project-pipeline";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { PlannedScopeCard } from "@/components/roadmap/module-roadmap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listIntegrationViews } from "@/lib/data/integrations";
import { listProjects } from "@/lib/data/projects";
import { todayInTimeZone } from "@/lib/format";
import { MODULE_PLANS } from "@/lib/roadmap";
import { PROJECT_TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = { title: "Game Studio" };

const PIPELINE_LIMIT = 100;

export default function GameStudioPage() {
  return (
    <>
      <PageHeader
        eyebrow="Game Studio"
        title="Game Studio"
        description={MODULE_PLANS["game-studio"].summary}
        actions={
          <ProjectFormDialog
            openAfterCreate
            defaultCategory="game"
            trigger={
              <Button>
                <Plus /> New game project
              </Button>
            }
          />
        }
      />
      <Suspense fallback={<ModuleSkeleton />}>
        <GameStudioContent />
      </Suspense>
    </>
  );
}

async function GameStudioContent() {
  const { supabase, settings } = await requireWorkspace();
  const [projects, integrations] = await Promise.all([
    listProjects(supabase, { category: "game", pageSize: PIPELINE_LIMIT }),
    listIntegrationViews(supabase),
  ]);
  const today = todayInTimeZone(settings.timezone);
  const stores = integrations.filter((integration) => integration.category === "games");

  return (
    <div className="grid grid-cols-1 gap-6">
      <section aria-labelledby="game-pipeline" className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="game-pipeline" className="text-base font-semibold">
              Release pipeline
            </h2>
            <p className="text-sm text-muted-foreground">Game projects by status. Open a project to manage its tasks.</p>
          </div>
          <Link href="/projects?category=game" className="text-xs text-primary hover:underline">
            {projects.total} game project{projects.total === 1 ? "" : "s"} in Projects
          </Link>
        </div>
        {projects.total === 0 ? (
          <EmptyState
            icon={Gamepad2}
            title="No game projects yet"
            description="Create a project with the Game category to see it in the pipeline."
            action={
              <ProjectFormDialog
                openAfterCreate
                defaultCategory="game"
                trigger={
                  <Button size="sm">
                    <Plus /> New game project
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
                <Link href="/projects?category=game" className="text-primary hover:underline">
                  See all
                </Link>
              </p>
            )}
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChecklistTemplateCard
          template={PROJECT_TEMPLATES.game_release}
          applyHint="Open a game project and choose “Add release checklist” to copy these steps into it as tasks."
        />
        <div className="grid grid-cols-1 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Store platforms</CardTitle>
              <CardDescription>
                Configuration status only. No store console is contacted in this phase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationStatusList integrations={stores} />
            </CardContent>
          </Card>
          <PlannedScopeCard plan={MODULE_PLANS["game-studio"]} />
        </div>
      </div>
    </div>
  );
}

function ModuleSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-48 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
