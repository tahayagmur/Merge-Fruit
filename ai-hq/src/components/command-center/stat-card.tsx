import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "accent" | "warning" | "destructive" | "success";
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="hq-label line-clamp-2 min-h-8 leading-4">{label}</p>
        <Icon
          className={cn(
            "size-4 shrink-0 text-muted-foreground",
            tone === "accent" && "text-primary",
            tone === "warning" && "text-warning",
            tone === "destructive" && "text-destructive",
            tone === "success" && "text-success",
          )}
        />
      </div>
      <p
        className={cn(
          "mt-3 font-mono text-3xl font-semibold tracking-tight tabular-nums",
          tone === "warning" && value > 0 && "text-warning",
          tone === "destructive" && value > 0 && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
