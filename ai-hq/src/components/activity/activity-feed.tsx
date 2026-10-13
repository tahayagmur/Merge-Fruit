import { CircleDot, FolderKanban, ListChecks, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import type { ActivityAction, ActivityEntityType, ActivityEntry } from "@/lib/domain";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ENTITY_ICON: Record<ActivityEntityType, typeof FolderKanban> = {
  project: FolderKanban,
  task: ListChecks,
  automation: Workflow,
};

const ACTION_ICON: Record<ActivityAction, typeof Plus> = {
  created: Plus,
  updated: Pencil,
  status_changed: CircleDot,
  deleted: Trash2,
};

const ACTION_COLOR: Record<ActivityAction, string> = {
  created: "text-success",
  updated: "text-chart-2",
  status_changed: "text-primary",
  deleted: "text-destructive",
};

export function ActivityFeed({ entries, now, compact }: { entries: ActivityEntry[]; now: Date; compact?: boolean }) {
  return (
    <ol className="relative flex flex-col">
      {entries.map((entry, index) => {
        const EntityIcon = ENTITY_ICON[entry.entityType];
        const ActionIcon = ACTION_ICON[entry.action];
        return (
          <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < entries.length - 1 && (
              <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" aria-hidden />
            )}
            <span className="relative grid size-8 shrink-0 place-items-center rounded-lg border bg-muted">
              <EntityIcon className="size-3.5 text-muted-foreground" />
              <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full border bg-card">
                <ActionIcon className={cn("size-2.5", ACTION_COLOR[entry.action])} />
              </span>
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn("text-sm", compact && "truncate")}>{entry.summary}</p>
              <p className="text-xs text-muted-foreground">
                <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toISOString()}>
                  {formatRelativeTime(entry.createdAt, now)}
                </time>
                <span className="mx-1.5">·</span>
                <span className="capitalize">{entry.entityType}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
