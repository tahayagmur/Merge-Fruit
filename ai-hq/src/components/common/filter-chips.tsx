import Link from "next/link";
import { cn } from "@/lib/utils";

interface FilterChipsProps {
  label: string;
  /** Query parameter controlled by this group. */
  param: string;
  options: Array<{ value: string; label: string }>;
  current?: string;
  basePath: string;
  params: Record<string, string | undefined>;
  allLabel?: string;
}

function href(basePath: string, params: Record<string, string | undefined>, param: string, value?: string) {
  const search = new URLSearchParams();
  for (const [key, item] of Object.entries(params)) if (item && key !== param && key !== "page") search.set(key, item);
  if (value) search.set(param, value);
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Link-based filter group: the URL holds the state, so filters survive reloads and sharing. */
export function FilterChips({ label, param, options, current, basePath, params, allLabel = "All" }: FilterChipsProps) {
  const chip = (active: boolean) =>
    cn(
      "rounded-md border px-2.5 py-1 text-xs transition-colors hover:border-primary/30 hover:text-foreground",
      active ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground",
    );
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Filter by ${label.toLowerCase()}`}>
      <span className="hq-label mr-1 w-20 shrink-0">{label}</span>
      <Link href={href(basePath, params, param)} aria-current={!current ? "true" : undefined} className={chip(!current)}>
        {allLabel}
      </Link>
      {options.map((option) => (
        <Link
          key={option.value}
          href={href(basePath, params, param, option.value)}
          aria-current={current === option.value ? "true" : undefined}
          className={chip(current === option.value)}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
