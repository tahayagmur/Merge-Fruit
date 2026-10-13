import { Activity, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { listActivity } from "@/lib/data/activity";
import { ACTIVITY_ENTITY_TYPES, type ActivityEntityType } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { activityQuerySchema } from "@/lib/validation/activity";

export const metadata: Metadata = { title: "Activity Logs" };

const FILTER_LABELS: Record<ActivityEntityType, string> = {
  project: "Projects",
  task: "Tasks",
  automation: "Automations",
};

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

function filterHref(entityType?: ActivityEntityType) {
  return entityType ? `/activity?entityType=${entityType}` : "/activity";
}

async function ActivityContent({ searchParams }: { searchParams: PageProps<"/activity">["searchParams"] }) {
  const raw = await searchParams;
  const parsed = activityQuerySchema.safeParse({
    entityType: typeof raw.entityType === "string" ? raw.entityType : undefined,
    before: typeof raw.before === "string" ? raw.before : undefined,
    limit: 50,
  });
  const query = parsed.success ? parsed.data : { limit: 50 };

  const { supabase } = await requireUser();
  const page = await listActivity(supabase, query);
  const now = new Date();

  const nextHref = page.nextCursor
    ? `/activity?${new URLSearchParams({
        ...(query.entityType ? { entityType: query.entityType } : {}),
        before: String(page.nextCursor),
      })}`
    : null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by type">
        {[undefined, ...ACTIVITY_ENTITY_TYPES].map((type) => {
          const active = query.entityType === type;
          return (
            <Link
              key={type ?? "all"}
              href={filterHref(type)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors hover:border-primary/30 hover:text-foreground",
                active ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              {type ? FILTER_LABELS[type] : "All"}
            </Link>
          );
        })}
      </div>
      <Card>
        <CardContent>
          {page.entries.length === 0 ? (
            <EmptyState icon={Activity} title="No activity" description="Changes to projects, tasks and automations appear here." />
          ) : (
            <ActivityFeed entries={page.entries} now={now} />
          )}
        </CardContent>
      </Card>
      <div className="flex justify-between">
        {query.before ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={filterHref(query.entityType)}>Newest</Link>
          </Button>
        ) : (
          <span />
        )}
        {nextHref && (
          <Button variant="outline" size="sm" asChild>
            <Link href={nextHref}>
              Older <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
