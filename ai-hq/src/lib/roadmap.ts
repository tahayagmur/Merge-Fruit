/**
 * The AI HQ development plan. Single source of truth for the roadmap page,
 * the "what is planned" sections of partially available modules and
 * docs/ROADMAP.md.
 */

export type ModuleStatus = "live" | "partial" | "planned";

export interface RoadmapPhase {
  phase: number;
  title: string;
  goal: string;
  status: "done" | "next" | "later";
}

export interface ModulePlan {
  id: string;
  title: string;
  status: ModuleStatus;
  /** Phase in which the remaining (external) parts are planned. */
  phase: number;
  summary: string;
  planned: string[];
  dependsOn: string[];
}

export const ROADMAP_PHASES: RoadmapPhase[] = [
  {
    phase: 1,
    title: "Working foundation",
    goal: "Auth, database, Command Center, Projects & tasks, Automation catalogue, activity log.",
    status: "done",
  },
  {
    phase: 2,
    title: "Core system",
    goal: "Roles, workspace settings, AI agent definitions and task queue, integration framework, demo data separation, search, Docker packaging.",
    status: "done",
  },
  {
    phase: 3,
    title: "n8n connection",
    goal: "Connect your existing n8n Cloud workflows server-side, link them to automation entries, trigger them and record executions. AI HQ does not create workflows.",
    status: "next",
  },
  {
    phase: 4,
    title: "Agent runtime",
    goal: "Run queued agent tasks on the server with a model provider, with audited prompts, cost tracking and results.",
    status: "later",
  },
  {
    phase: 5,
    title: "Game platforms",
    goal: "Release and review status from Google Play Console and App Store Connect in Game Studio.",
    status: "later",
  },
  {
    phase: 6,
    title: "Business data",
    goal: "Read-only revenue, churn and customer figures for SaaS & Business.",
    status: "later",
  },
];

export const MODULE_PLANS: Record<string, ModulePlan> = {
  "game-studio": {
    id: "game-studio",
    title: "Game Studio",
    status: "partial",
    phase: 5,
    summary: "Game projects, release pipeline and checklists work today; store data arrives with the platform integrations.",
    planned: [
      "Build and release status per platform from the store consoles",
      "Store review import as tasks",
      "Trigger your existing n8n workflows for builds and release notes",
    ],
    dependsOn: ["Google Play Console and App Store Connect credentials (server-side only)", "Phase 3: n8n connection"],
  },
  saas: {
    id: "saas",
    title: "SaaS & Business",
    status: "partial",
    phase: 6,
    summary: "SaaS products and launch checklists work today; revenue figures need a read-only payment provider integration.",
    planned: [
      "MRR, revenue and churn from read-only payment provider data",
      "Customer overview",
      "Weekly KPI report linked to one of your existing n8n workflows",
    ],
    dependsOn: ["Stripe restricted read-only key (server-side only)", "Phase 3: n8n connection"],
  },
  agents: {
    id: "agents",
    title: "AI Agent Hub",
    status: "partial",
    phase: 4,
    summary: "Agent definitions and the task queue work today; tasks run once an agent runtime and a model provider are connected.",
    planned: [
      "Server-side runtime that picks up queued tasks",
      "Model provider calls with token and cost tracking",
      "Results and errors recorded on each task",
      "Hand-off to your existing n8n workflows for actions with side effects",
    ],
    dependsOn: ["Model provider API key as a server secret", "Phase 3: n8n connection (for actions)"],
  },
  integrations: {
    id: "integrations",
    title: "Integrations",
    status: "partial",
    phase: 3,
    summary: "Every integration can be prepared (settings, required secrets, status); connectors are added one by one.",
    planned: [
      "n8n connector with connection test (Phase 3)",
      "Model provider connectors (Phase 4)",
      "Store console connectors (Phase 5)",
      "Payment provider connector (Phase 6)",
    ],
    dependsOn: ["Server environment variables for each integration's credentials"],
  },
  settings: {
    id: "settings",
    title: "Settings",
    status: "live",
    phase: 2,
    summary: "Profile, password, sessions, workspace settings, roles and demo data.",
    planned: ["Multi-factor authentication", "Notification preferences", "Data export"],
    dependsOn: ["Supabase Auth MFA enabled for the project"],
  },
};
