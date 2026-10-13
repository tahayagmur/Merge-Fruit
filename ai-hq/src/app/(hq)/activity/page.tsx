import { Activity, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { EmptyState } from "@/components/common/empty-state";
import { FilterChips } from "@/components/common/filter-chips";
import { SearchForm } from "@/components/common/search-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listActivity } from "@/lib/data/activity";
import { ACTIVITY_ENTITY_LABELS, ACTIVITY_ENTITY_TYPES } from "@/lib/domain";
import { type ActivityQuery, activityQuerySchema } from "@/lib/validation/activity";

export const metadata: Metadata = { title: "Activity Logs" };

const PAGE_SIZE = 50;

export default function ActivityPage(props: PageProps<"/activity">) {
  return (
    <>
      <PageHeader
        eyebrow="Activity Logs"
        title="Activity"
        description="An append-only audit trail. Entries are written by database triggers and cannot be edited or deleted from the app."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <ActivityContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function activityHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `/activity?${query}` : "/activity";
}

async function ActivityContent({ searchParams }: { searchParams: PageProps<"/activity">["searchParams"] }) {
  const raw = await searchParams;
  const parsed = activityQuerySchema.safeParse({
    entityType: single(raw.entityType),
    before: single(raw.before),
    q: single(raw.q),
    limit: PAGE_SIZE,
  });
  // Invalid parameters fall back to the unfiltered first page instead of an error screen.
  const query: ActivityQuery = parsed.success ? parsed.data : { limit: PAGE_SIZE, q: undefined };

  const { supabase } = await requireWorkspace();
  const page = await listActivity(supabase, query);
  const now = new Date();

  const params = { entityType: query.entityType, q: query.q };
  const filtered = Boolean(query.entityType || query.q);
  const nextHref = page.nextCursor ? activityHref({ ...params, before: String(page.nextCursor) }) : null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <FilterChips
          label="Type"
          param="entityType"
          current={query.entityType}
          basePath="/activity"
          params={params}
          options={ACTIVITY_ENTITY_TYPES.map((value) => ({ value, label: ACTIVITY_ENTITY_LABELS[value] }))}
        />
        <SearchForm
          basePath="/activity"
          params={params}
          defaultValue={query.q}
          placeholder="Search summaries"
          label="Search activity"
        />
      </div>
      <Card>
        <CardContent>
          {page.entries.length === 0 ? (
            <EmptyState
              icon={Activity}
              title={filtered ? "No matching activity" : "No activity yet"}
              description={
                filtered
                  ? "Try another type or search term."
                  : "Changes to projects, tasks, automations, agents, settings and integrations appear here."
              }
            />
          ) : (
            <ActivityFeed entries={page.entries} now={now} />
          )}
        </CardContent>
      </Card>
      <nav aria-label="Pagination" className="flex justify-between">
        {query.before ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={activityHref(params)}>Newest</Link>
          </Button>
        ) : (
          <span />
        )}
        {nextHref && (
          <Button variant="outline" size="sm" asChild>
            <Link href={nextHref} rel="next">
              Older <ArrowRight />
            </Link>
          </Button>
        )}
      </nav>
    </div>
  );
}
