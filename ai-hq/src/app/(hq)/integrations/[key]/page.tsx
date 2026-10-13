import { ArrowLeft, CircleCheck, CircleDashed, PlugZap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IntegrationStatusBadge } from "@/components/common/status-badges";
import { StatusIndicator } from "@/components/common/status-indicator";
import { IntegrationSettingsForm } from "@/components/integrations/integration-settings-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isAdminRole, requireWorkspace } from "@/lib/auth/workspace";
import { getIntegrationView } from "@/lib/data/integrations";
import { formatDateTime } from "@/lib/format";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { INTEGRATION_CATEGORY_LABELS, type SettingField } from "@/lib/integrations/types";

export const metadata: Metadata = { title: "Integration" };

export default function IntegrationPage(props: PageProps<"/integrations/[key]">) {
  return (
    <>
      <div className="pt-6">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href="/integrations">
            <ArrowLeft /> Integrations
          </Link>
        </Button>
      </div>
      <Suspense fallback={<IntegrationSkeleton />}>
        <IntegrationContent params={props.params} />
      </Suspense>
    </>
  );
}

function displayValue(field: SettingField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "Not set";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not set";
  if (field.type === "select") return field.options?.find((option) => option.value === value)?.label ?? String(value);
  return String(value);
}

async function IntegrationContent({ params }: { params: PageProps<"/integrations/[key]">["params"] }) {
  const { key } = await params;
  if (!getIntegrationDefinition(key)) notFound();

  const { supabase, profile, settings: workspace } = await requireWorkspace();
  const integration = await getIntegrationView(supabase, key);
  const canEdit = isAdminRole(profile.role);

  return (
    <div className="grid grid-cols-1 gap-6 pt-2 pb-8">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <IntegrationStatusBadge status={integration.status} />
          <span className="text-xs text-muted-foreground">{INTEGRATION_CATEGORY_LABELS[integration.category]}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{integration.name}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{integration.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="grid grid-cols-1 content-start gap-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>Computed on the server from the saved settings, server secrets and connection tests.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {integration.statusReasons.length > 0 && (
                <ul className="grid gap-2">
                  {integration.statusReasons.map((reason) => (
                    <li key={reason} className="flex gap-2 text-sm text-muted-foreground">
                      <CircleDashed className="mt-0.5 size-4 shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
              <Alert>
                <PlugZap />
                <AlertDescription>
                  <p>
                    {integration.connectorAvailable
                      ? "A connector is available for this integration."
                      : `Connection test unavailable: the connector is planned for Phase ${integration.plannedPhase}. AI HQ sends no requests to ${integration.name} until then.`}
                  </p>
                </AlertDescription>
              </Alert>
              <dl className="grid grid-cols-2 gap-4 text-xs">
                <div className="grid gap-1">
                  <dt className="hq-label">Last connection test</dt>
                  <dd className="text-muted-foreground">
                    {integration.lastTestedAt ? formatDateTime(integration.lastTestedAt, workspace.timezone) : "Never"}
                  </dd>
                </div>
                <div className="grid gap-1">
                  <dt className="hq-label">Settings saved</dt>
                  <dd className="text-muted-foreground">
                    {integration.updatedAt ? formatDateTime(integration.updatedAt, workspace.timezone) : "Never"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                {canEdit
                  ? "Non-secret settings, validated on the server. Never paste API keys or tokens here."
                  : "Only workspace owners and admins can change integration settings."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canEdit ? (
                <IntegrationSettingsForm
                  integrationKey={integration.key}
                  name={integration.name}
                  fields={integration.settingFields}
                  settings={integration.settings}
                  enabled={integration.enabled}
                  saved={integration.updatedAt !== null}
                />
              ) : (
                <dl className="grid gap-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Enabled</dt>
                    <dd>{integration.enabled ? "Yes" : "No"}</dd>
                  </div>
                  {integration.settingFields.map((field) => (
                    <div key={field.key} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{field.label}</dt>
                      <dd className="truncate font-mono text-xs">{displayValue(field, integration.settings[field.key])}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 content-start gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Server secrets</CardTitle>
              <CardDescription>
                Set as environment variables on the server. AI HQ only checks whether they exist; values are never stored in
                the database, sent to the browser or logged.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variable</TableHead>
                    <TableHead className="text-right">State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integration.secrets.map((secret) => (
                    <TableRow key={secret.env}>
                      <TableCell>
                        <span className="grid gap-0.5">
                          <code className="font-mono text-xs">{secret.env}</code>
                          <span className="text-xs text-muted-foreground">
                            {secret.label}
                            {secret.required ? "" : " · optional"}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {secret.present ? (
                          <StatusIndicator tone="success" label="Set" />
                        ) : (
                          <StatusIndicator tone={secret.required ? "warning" : "neutral"} label="Missing" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Planned use</CardTitle>
              <CardDescription>What AI HQ will do once the connector is installed (Phase {integration.plannedPhase}).</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {integration.plannedUse.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function IntegrationSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 pt-2" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Skeleton className="h-96 rounded-xl lg:col-span-3" />
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}
