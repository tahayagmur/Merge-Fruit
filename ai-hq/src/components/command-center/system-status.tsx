import { CheckCircle2, CircleDashed, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { INTEGRATION_STATUS_LABELS, INTEGRATION_STATUS_TONE } from "@/components/common/status-badges";
import { StatusIndicator } from "@/components/common/status-indicator";
import { EnvBadge } from "@/components/layout/env-badge";
import type { AppEnv } from "@/lib/env";
import { INTEGRATION_STATUSES, type IntegrationView } from "@/lib/integrations/types";

function Row({ label, value, ok, children }: { label: string; value: string; ok: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        {ok ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        ) : (
          <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{value}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function SystemStatus({
  appEnv,
  timezone,
  integrations,
}: {
  appEnv: AppEnv;
  timezone: string;
  integrations: IntegrationView[];
}) {
  const counts = Object.fromEntries(
    INTEGRATION_STATUSES.map((status) => [status, integrations.filter((item) => item.status === status).length]),
  ) as Record<(typeof INTEGRATION_STATUSES)[number], number>;
  return (
    <div className="divide-y divide-border">
      <Row label="Database" value="Supabase Postgres · row level security on every table" ok />
      <Row label="Authentication" value="Session verified on the server for this request" ok>
        <ShieldCheck className="size-4 shrink-0 text-primary" />
      </Row>
      <Row label="Environment" value={`Separate Supabase project per environment · time zone ${timezone}`} ok>
        <EnvBadge env={appEnv} />
      </Row>
      <Row label="External integrations" value="None connected in this phase. No external system is contacted." ok={false}>
        <Link href="/integrations" className="text-xs text-primary hover:underline">
          Open
        </Link>
      </Row>
      <div className="flex flex-wrap gap-2 pt-3">
        {INTEGRATION_STATUSES.map((status) => (
          <StatusIndicator
            key={status}
            tone={INTEGRATION_STATUS_TONE[status]}
            label={`${INTEGRATION_STATUS_LABELS[status]} · ${counts[status]}`}
          />
        ))}
      </div>
    </div>
  );
}
