import { FolderKanban, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectFilters } from "@/components/projects/project-filters";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { listProjects } from "@/lib/data/projects";
import { todayUtc } from "@/lib/format";
import { projectListQuerySchema } from "@/lib/validation/projects";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage(props: PageProps<"/projects">) {
  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description="Every initiative with its tasks, status and progress. Changes are saved to the database immediately."
        actions={
          <ProjectFormDialog
            openAfterCreate
            trigger={
              <Button>
                <Plus /> New project
              </Button>
            }
          />
        }
      />
      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function ProjectsContent({ searchParams }: { searchParams: PageProps<"/projects">["searchParams"] }) {
  const raw = await searchParams;
  const parsed = projectListQuerySchema.safeParse({
    status: typeof raw.status === "string" ? raw.status : undefined,
    category: typeof raw.category === "string" ? raw.category : undefined,
  });
  const filters = parsed.success ? parsed.data : {};

  const { supabase } = await requireUser();
  const projects = await listProjects(supabase, filters);
  const today = todayUtc();
  const filtered = Boolean(filters.status || filters.category);

  return (
    <>
      <ProjectFilters status={filters.status} category={filters.category} />
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={filtered ? "No projects match these filters" : "No projects yet"}
          description={filtered ? "Try another status or category." : "Create your first project to start tracking work."}
          action={
            !filtered && (
              <ProjectFormDialog
                openAfterCreate
                defaultCategory={filters.category}
                trigger={
                  <Button size="sm">
                    <Plus /> New project
                  </Button>
                }
              />
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} today={today} />
          ))}
        </div>
      )}
    </>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-48 rounded-xl" />
      ))}
    </div>
  );
}
