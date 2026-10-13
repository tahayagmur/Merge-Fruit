import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RoleBadge } from "@/components/common/status-badges";
import { EnvBadge } from "@/components/layout/env-badge";
import { PageHeader } from "@/components/layout/page-header";
import { DemoDataPanel } from "@/components/settings/demo-data-panel";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { RoleControl } from "@/components/settings/role-control";
import { SignOutEverywhere } from "@/components/settings/sign-out-everywhere";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isAdminRole, requireWorkspace, type WorkspaceContext } from "@/lib/auth/workspace";
import { listIntegrationViews } from "@/lib/data/integrations";
import { listProfiles } from "@/lib/data/profiles";
import { getDemoDataStatus } from "@/lib/demo/service";
import { getServerEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "workspace", label: "Workspace" },
  { id: "users", label: "Users & roles" },
  { id: "demo", label: "Demo data" },
  { id: "environment", label: "Environment" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTab(value: unknown): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

export default function SettingsPage(props: PageProps<"/settings">) {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Settings" description="Your account, the workspace and how AI HQ is configured." />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <SettingsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function SettingsContent({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  const raw = await searchParams;
  const tab: TabId = isTab(raw.tab) ? raw.tab : "profile";
  const workspace = await requireWorkspace();

  return (
    <div className="grid grid-cols-1 gap-6 pb-8 lg:grid-cols-[12rem_1fr]">
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={item.id === "profile" ? "/settings" : `/settings?tab=${item.id}`}
            aria-current={tab === item.id ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent/40 hover:text-foreground",
              tab === item.id ? "bg-accent/60 font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="grid min-w-0 content-start gap-6">
        {tab === "profile" && <ProfileTab workspace={workspace} />}
        {tab === "security" && <SecurityTab />}
        {tab === "workspace" && <WorkspaceTab workspace={workspace} />}
        {tab === "users" && <UsersTab workspace={workspace} />}
        {tab === "demo" && <DemoTab workspace={workspace} />}
        {tab === "environment" && <EnvironmentTab workspace={workspace} />}
      </div>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm sm:col-span-2">{children}</dd>
    </div>
  );
}

function ProfileTab({ workspace }: { workspace: WorkspaceContext }) {
  const { profile, user } = workspace;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How you appear in AI HQ.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <dl className="divide-y divide-border">
          <Item label="E-mail">{user.email ?? "—"}</Item>
          <Item label="Role">
            <RoleBadge role={profile.role} />
          </Item>
        </dl>
        <ProfileForm displayName={profile.displayName} />
      </CardContent>
    </Card>
  );
}

function SecurityTab() {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Your current password is checked again before the change. Other sessions are signed out.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            Sessions are stored in secure, http-only cookies and expire after 7 days. Revoke all of them if a device is lost.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutEverywhere />
        </CardContent>
      </Card>
    </>
  );
}

function WorkspaceTab({ workspace }: { workspace: WorkspaceContext }) {
  const { settings, profile } = workspace;
  const canEdit = isAdminRole(profile.role);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          {canEdit ? "Shared by everyone in this AI HQ." : "Only workspace owners and admins can change these settings."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canEdit ? (
          <WorkspaceForm
            workspaceName={settings.workspaceName}
            timezone={settings.timezone}
            timeZones={Intl.supportedValuesOf("timeZone")}
          />
        ) : (
          <dl className="divide-y divide-border">
            <Item label="Workspace name">{settings.workspaceName}</Item>
            <Item label="Time zone">
              <code className="font-mono text-xs">{settings.timezone}</code>
            </Item>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

async function UsersTab({ workspace }: { workspace: WorkspaceContext }) {
  const { supabase, profile } = workspace;
  if (!isAdminRole(profile.role)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Users & roles</CardTitle>
          <CardDescription>Only workspace owners and admins can see the user list.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 text-sm">
            Your role: <RoleBadge role={profile.role} />
          </p>
        </CardContent>
      </Card>
    );
  }
  const profiles = await listProfiles(supabase);
  const isOwner = profile.role === "owner";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Users & roles</CardTitle>
        <CardDescription>
          Accounts are created in Supabase Auth (sign-up is disabled). Owners manage roles; admins manage settings and
          integrations; members work with projects, automations and agents.
          {!isOwner && " Only an owner can change roles."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden sm:table-cell">Since</TableHead>
              <TableHead className="text-right">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((item) => {
              const label = item.displayName || item.email || "User";
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="grid gap-0.5">
                      <span className="font-medium">
                        {label}
                        {item.id === profile.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                      </span>
                      {item.displayName && <span className="text-xs text-muted-foreground">{item.email}</span>}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {item.createdAt ? formatDate(item.createdAt.slice(0, 10)) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex justify-end">
                      {isOwner ? (
                        <RoleControl userId={item.id} label={label} role={item.role} isSelf={item.id === profile.id} />
                      ) : (
                        <RoleBadge role={item.role} />
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

async function DemoTab({ workspace }: { workspace: WorkspaceContext }) {
  const counts = await getDemoDataStatus(workspace.supabase);
  const env = getServerEnv();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo data</CardTitle>
        <CardDescription>
          A small labelled dataset for trying AI HQ. Command Center figures exclude it unless you include it explicitly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DemoDataPanel counts={counts} production={env.appEnv === "production"} />
      </CardContent>
    </Card>
  );
}

async function EnvironmentTab({ workspace }: { workspace: WorkspaceContext }) {
  const env = getServerEnv();
  const integrations = await listIntegrationViews(workspace.supabase);
  const connected = integrations.filter((integration) => integration.status === "connected").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Environment</CardTitle>
        <CardDescription>Read-only. Values come from the server configuration; secrets are never displayed.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">
          <Item label="Environment">
            <EnvBadge env={env.appEnv} />
          </Item>
          <Item label="Supabase project">
            <code className="font-mono text-xs break-all">{new URL(env.supabaseUrl).host}</code>
          </Item>
          <Item label="Access policy">
            {env.allowedEmails.length > 0
              ? `Allowlist active (${env.allowedEmails.length} ${env.allowedEmails.length === 1 ? "account" : "accounts"})`
              : "Any account in this Supabase project (allowed outside production only)"}
          </Item>
          <Item label="User id">
            <code className="font-mono text-xs break-all">{workspace.user.id}</code>
          </Item>
          <Item label="External integrations">
            {connected === 0 ? "None connected" : `${connected} connected`} ·{" "}
            <Link href="/integrations" className="text-primary hover:underline">
              Integrations
            </Link>
          </Item>
          <Item label="Health checks">
            <code className="font-mono text-xs">/api/health</code> (liveness) ·{" "}
            <code className="font-mono text-xs">/api/health/ready</code> (database &amp; auth)
          </Item>
        </dl>
      </CardContent>
    </Card>
  );
}
