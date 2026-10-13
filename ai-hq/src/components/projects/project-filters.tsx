import Link from "next/link";
import {
  PROJECT_CATEGORIES,
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type ProjectCategory,
  type ProjectStatus,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

function href(status?: ProjectStatus, category?: ProjectCategory) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (category) params.set("category", category);
  const query = params.toString();
  return query ? `/projects?${query}` : "/projects";
}

function Chip({ active, href: target, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={target}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs transition-colors hover:border-primary/30 hover:text-foreground",
        active ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export function ProjectFilters({ status, category }: { status?: ProjectStatus; category?: ProjectCategory }) {
  return (
    <div className="flex flex-col gap-3 pb-6">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
        <span className="hq-label mr-1 w-16">Status</span>
        <Chip active={!status} href={href(undefined, category)}>
          All
        </Chip>
        {PROJECT_STATUSES.map((value) => (
          <Chip key={value} active={status === value} href={href(value, category)}>
            {PROJECT_STATUS_LABELS[value]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
        <span className="hq-label mr-1 w-16">Category</span>
        <Chip active={!category} href={href(status, undefined)}>
          All
        </Chip>
        {PROJECT_CATEGORIES.map((value) => (
          <Chip key={value} active={category === value} href={href(status, value)}>
            {PROJECT_CATEGORY_LABELS[value]}
          </Chip>
        ))}
      </div>
    </div>
  );
}
