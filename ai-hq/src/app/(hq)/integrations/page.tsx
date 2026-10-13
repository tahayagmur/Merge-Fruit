import { CircleDashed } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ModuleRoadmap } from "@/components/roadmap/module-roadmap";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { getN8nStatus } from "@/lib/integrations/n8n/service";
import { MODULE_PLANS } from "@/lib/roadmap";

export const metadata: Metadata = { title: "Integrations" };

const CONFIGURATION_LABEL = {
  not_configured: "Server variables not set",
  invalid: "Server variables invalid",
  ready_for_phase_2: "Server variables ready",
} as const;

async function N8nStatusCard() {
  await requireUser();
  const status = getN8nStatus();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleDashed className="size-4 text-muted-foreground" /> {status.name}
        </CardTitle>
        <CardDescription>{status.message}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Connection: not connected</Badge>
          <Badge variant={status.configuration === "invalid" ? "destructive" : "muted"}>
            {CONFIGURATION_LABEL[status.configuration]}
          </Badge>
        </div>
        {status.configurationIssues.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-destructive">
            {status.configurationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function IntegrationsPage() {
  return (
    <ModuleRoadmap plan={MODULE_PLANS.integrations}>
      <Suspense fallback={<Skeleton className="h-36 rounded-xl" />}>
        <N8nStatusCard />
      </Suspense>
    </ModuleRoadmap>
  );
}
