import { CheckCircle2, CircleDashed, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { EnvBadge } from "@/components/layout/env-badge";
import type { AppEnv } from "@/lib/env";
import type { IntegrationStatus } from "@/lib/integrations/n8n/service";

function Row({ label, value, ok, children }: { label: string; value: string; ok: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        {ok ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        ) : (
          <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{value}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function SystemStatus({ appEnv, n8n }: { appEnv: AppEnv; n8n: IntegrationStatus }) {
  return (
    <div className="divide-y divide-border">
      <Row label="Database" value="Supabase Postgres · row level security on every table" ok />
      <Row label="Authentication" value="Session verified on the server for this request" ok>
        <ShieldCheck className="size-4 text-primary" />
      </Row>
      <Row label="Environment" value="Development and production use separate Supabase projects" ok>
        <EnvBadge env={appEnv} />
      </Row>
      <Row label="n8n Cloud" value={`Not connected · planned for Phase ${n8n.plannedPhase}`} ok={false}>
        <Link href="/integrations" className="text-xs text-primary hover:underline">
          Plan
        </Link>
      </Row>
    </div>
  );
}
