import type { AppEnv } from "@/lib/env";
import { cn } from "@/lib/utils";

const STYLES: Record<AppEnv, string> = {
  development: "border-warning/30 bg-warning/10 text-warning",
  staging: "border-chart-2/30 bg-chart-2/10 text-chart-2",
  production: "border-success/30 bg-success/10 text-success",
};

const LABELS: Record<AppEnv, string> = {
  development: "Development",
  staging: "Staging",
  production: "Production",
};

export function EnvBadge({ env }: { env: AppEnv }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[0.65rem] tracking-wider uppercase",
        STYLES[env],
      )}
      title={`APP_ENV=${env}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {LABELS[env]}
    </span>
  );
}
