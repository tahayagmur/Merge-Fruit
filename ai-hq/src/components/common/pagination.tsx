import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** Current query parameters to keep (filters, search). */
  params: Record<string, string | undefined>;
  basePath: string;
  label?: string;
}

function href(basePath: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value && key !== "page") search.set(key, value);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({ page, pageSize, total, params, basePath, label = "results" }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const linkClass =
    "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs transition-colors hover:border-primary/30 hover:text-foreground";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
      <p>
        {from}–{to} of {total} {label}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(basePath, params, page - 1)} className={linkClass} rel="prev">
            <ChevronLeft className="size-3.5" /> Previous
          </Link>
        ) : (
          <span className={cn(linkClass, "pointer-events-none opacity-40")} aria-disabled>
            <ChevronLeft className="size-3.5" /> Previous
          </span>
        )}
        <span className="font-mono">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(basePath, params, page + 1)} className={linkClass} rel="next">
            Next <ChevronRight className="size-3.5" />
          </Link>
        ) : (
          <span className={cn(linkClass, "pointer-events-none opacity-40")} aria-disabled>
            Next <ChevronRight className="size-3.5" />
          </span>
        )}
      </div>
    </nav>
  );
}
