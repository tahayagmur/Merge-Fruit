import { Bot, FolderKanban, ListTodo, Search, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { SearchForm } from "@/components/common/search-form";
import { DemoBadge } from "@/components/common/status-indicator";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireWorkspace } from "@/lib/auth/workspace";
import { globalSearch, type SearchHit } from "@/lib/data/search";
import { searchQuerySchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <>
      <PageHeader eyebrow="Search" title="Search" description="Projects, tasks, automations and agents you have access to." />
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <SearchContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

function ResultGroup({ title, icon: Icon, hits }: { title: string; icon: LucideIcon; hits: SearchHit[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-primary" /> {title}
          <span className="font-mono text-xs font-normal text-muted-foreground">{hits.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches.</p>
        ) : (
          <ul className="divide-y divide-border">
            {hits.map((hit) => (
              <li key={hit.id}>
                <Link href={hit.href} className="group flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-sm group-hover:text-primary">
                    <span className="truncate">{hit.title}</span>
                    {hit.isDemo && <DemoBadge />}
                  </span>
                  {hit.subtitle && <span className="shrink-0 text-xs text-muted-foreground">{hit.subtitle}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

async function SearchContent({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const raw = await searchParams;
  const parsed = searchQuerySchema.safeParse(typeof raw.q === "string" ? raw.q : undefined);
  const term = parsed.success ? parsed.data : undefined;
  const { supabase } = await requireWorkspace();
  const results = term ? await globalSearch(supabase, term, 10) : null;
  const total = results
    ? results.projects.length + results.tasks.length + results.automations.length + results.agents.length
    : 0;

  return (
    <div className="grid grid-cols-1 gap-6">
      <SearchForm basePath="/search" defaultValue={term} placeholder="Search everything" label="Search everything" className="sm:max-w-md" />
      {!results ? (
        <EmptyState icon={Search} title="Type at least two characters" description="Letters, digits and spaces are matched against names and descriptions." />
      ) : total === 0 ? (
        <EmptyState icon={Search} title={`No results for “${results.query}”`} description="Try a shorter or different term." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ResultGroup title="Projects" icon={FolderKanban} hits={results.projects} />
          <ResultGroup title="Tasks" icon={ListTodo} hits={results.tasks} />
          <ResultGroup title="Automations" icon={Workflow} hits={results.automations} />
          <ResultGroup title="Agents" icon={Bot} hits={results.agents} />
        </div>
      )}
    </div>
  );
}
