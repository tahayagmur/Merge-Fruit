import { FolderKanban, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { FilterChips } from "@/components/common/filter-chips";
import { Pagination } from "@/components/common/pagination";
import { SearchForm } from "@/components/common/search-form";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listProjects } from "@/lib/data/projects";
import { PROJECT_CATEGORIES, PROJECT_CATEGORY_LABELS, PROJECT_STATUS_LABELS, PROJECT_STATUSES } from "@/lib/domain";
import { todayInTimeZone } from "@/lib/format";
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

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

async function ProjectsContent({ searchParams }: { searchParams: PageProps<"/projects">["searchParams"] }) {
  const raw = await searchParams;
  const parsed = projectListQuerySchema.safeParse({
    status: single(raw.status),
    category: single(raw.category),
    q: single(raw.q),
    page: single(raw.page),
  });
  const filters = parsed.success ? parsed.data : { page: 1, q: undefined };
  const { supabase, settings } = await requireWorkspace();
  const result = await listProjects(supabase, filters);
  const today = todayInTimeZone(settings.timezone);
  const params = { status: filters.status, category: filters.category, q: filters.q };
  const filtered = Boolean(filters.status || filters.category || filters.q);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid gap-3">
          <FilterChips
            label="Status"
            param="status"
            current={filters.status}
            basePath="/projects"
            params={params}
            options={PROJECT_STATUSES.map((value) => ({ value, label: PROJECT_STATUS_LABELS[value] }))}
          />
          <FilterChips
            label="Category"
            param="category"
            current={filters.category}
            basePath="/projects"
            params={params}
            options={PROJECT_CATEGORIES.map((value) => ({ value, label: PROJECT_CATEGORY_LABELS[value] }))}
          />
        </div>
        <SearchForm basePath="/projects" params={params} defaultValue={filters.q} placeholder="Search projects" label="Search projects" />
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={filtered ? "No projects match" : "No projects yet"}
          description={filtered ? "Try another filter or search term." : "Create your first project to start tracking work."}
          action={
            !filtered && (
              <ProjectFormDialog
                openAfterCreate
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
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((project) => (
              <ProjectCard key={project.id} project={project} today={today} />
            ))}
          </div>
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            params={params}
            basePath="/projects"
            label="projects"
          />
        </>
      )}
    </div>
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
