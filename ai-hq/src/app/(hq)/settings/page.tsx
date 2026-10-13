import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { EnvBadge } from "@/components/layout/env-badge";
import { ModuleRoadmap } from "@/components/roadmap/module-roadmap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { getN8nStatus } from "@/lib/integrations/n8n/service";
import { MODULE_PLANS } from "@/lib/roadmap";

export const metadata: Metadata = { title: "Settings" };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:col-span-2">{children}</dd>
    </div>
  );
}

async function AccountSettings() {
  const { user } = await requireUser();
  const env = getServerEnv();
  const n8n = getN8nStatus();
  const supabaseHost = new URL(env.supabaseUrl).host;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account & environment</CardTitle>
        <CardDescription>Read-only in Phase 1. Values come from the server configuration.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <dl className="divide-y divide-border">
          <Item label="Email">{user.email ?? "—"}</Item>
          <Item label="User id">
            <code className="font-mono text-xs break-all">{user.id}</code>
          </Item>
          <Item label="Environment">
            <EnvBadge env={env.appEnv} />
          </Item>
          <Item label="Supabase project">
            <code className="font-mono text-xs">{supabaseHost}</code>
          </Item>
          <Item label="Access policy">
            {env.allowedEmails.length > 0
              ? `Allowlist active (${env.allowedEmails.length} ${env.allowedEmails.length === 1 ? "account" : "accounts"})`
              : "Any account in this Supabase project (allowed outside production only)"}
          </Item>
          <Item label="n8n">{`Not connected · Phase ${n8n.plannedPhase}`}</Item>
        </dl>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            <LogOut /> Sign out
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <ModuleRoadmap plan={MODULE_PLANS.settings}>
      <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
        <AccountSettings />
      </Suspense>
    </ModuleRoadmap>
  );
}
