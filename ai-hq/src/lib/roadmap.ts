/**
 * The AI HQ development plan. Single source of truth for the roadmap pages
 * and docs/ROADMAP.md. Modules that are not built yet render this plan instead
 * of placeholder UI, so nothing pretends to work before it does.
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
  phase: number;
  summary: string;
  /** What exists in the product today, stated plainly. */
  availableToday: string[];
  planned: string[];
  dependsOn: string[];
  /** Optional link to the part of the app that already covers this area. */
  todayLink?: { href: string; label: string };
}

export const ROADMAP_PHASES: RoadmapPhase[] = [
  {
    phase: 1,
    title: "Working foundation",
    goal: "Auth, database, Command Center, Projects & tasks, Automation drafts, activity log.",
    status: "done",
  },
  {
    phase: 2,
    title: "n8n connection",
    goal: "Connect your existing n8n Cloud workflows server-side, link them to automation entries, trigger them and record executions. AI HQ does not create workflows.",
    status: "next",
  },
  {
    phase: 3,
    title: "AI Agent Hub",
    goal: "Register agents, run them server-side with audited prompts, track cost and outcomes.",
    status: "later",
  },
  {
    phase: 4,
    title: "Game Studio",
    goal: "Production pipeline for game projects: milestones, builds, store listings and playtests.",
    status: "later",
  },
  {
    phase: 5,
    title: "SaaS & Business",
    goal: "Revenue, customers and KPI tracking with read-only finance integrations.",
    status: "later",
  },
];

export const MODULE_PLANS: Record<string, ModulePlan> = {
  "game-studio": {
    id: "game-studio",
    title: "Game Studio",
    status: "planned",
    phase: 4,
    summary: "A production pipeline for game projects, from prototype to store release.",
    availableToday: ["Game projects can be tracked in Projects with the “Game” category, including their tasks."],
    planned: [
      "Milestone templates (prototype, vertical slice, soft launch, release)",
      "Build and release log per platform",
      "Store listing checklist (screenshots, descriptions, age rating, privacy)",
      "Playtest feedback inbox linked to tasks",
      "Trigger your existing n8n workflows for builds and release notes",
    ],
    dependsOn: ["Phase 2: n8n connection (build/release automations)"],
    todayLink: { href: "/projects?category=game", label: "Open game projects" },
  },
  saas: {
    id: "saas",
    title: "SaaS & Business",
    status: "planned",
    phase: 5,
    summary: "One place for revenue, customers and business KPIs across products.",
    availableToday: ["SaaS work can be tracked in Projects with the “SaaS & Business” category."],
    planned: [
      "Product catalogue with pricing and status",
      "MRR / revenue and churn dashboard from read-only payment provider data",
      "Customer and lead overview",
      "Link the weekly KPI report to one of your existing n8n workflows",
    ],
    dependsOn: ["Phase 2: n8n connection", "Read-only API credentials for the payment provider (server-side only)"],
    todayLink: { href: "/projects?category=saas", label: "Open SaaS projects" },
  },
  agents: {
    id: "agents",
    title: "AI Agent Hub",
    status: "planned",
    phase: 3,
    summary: "Define AI agents, run them on the server and keep a full audit trail.",
    availableToday: ["AI agent initiatives can be tracked in Projects with the “AI Agent” category."],
    planned: [
      "Agent registry: purpose, model, tools and owner",
      "Versioned prompts with review before activation",
      "Server-side runs only; API keys never reach the browser",
      "Run history with inputs, outputs, cost and duration in the activity log",
      "Hand-off to your existing n8n workflows for actions with side effects",
    ],
    dependsOn: ["Phase 2: n8n connection", "Model provider API key stored as a server secret"],
    todayLink: { href: "/projects?category=ai_agent", label: "Open AI agent projects" },
  },
  integrations: {
    id: "integrations",
    title: "Integrations",
    status: "planned",
    phase: 2,
    summary: "Connections to external services, starting with the n8n Cloud workflows you already run. AI HQ connects to them; it does not create or edit workflows.",
    availableToday: [
      "A server-only n8n service layer with configuration validation. It never connects in Phase 1.",
      "Automation entries in the Automation Center can reference the id of one of your n8n workflows.",
    ],
    planned: [
      "n8n Cloud connection test from the server",
      "Read-only list of your existing workflows",
      "Linking each automation entry to one of your workflows",
      "Triggering linked workflows with idempotency keys",
      "Signed inbound webhooks (HMAC) for execution results",
      "Execution history in Activity Logs",
    ],
    dependsOn: [
      "Your existing n8n workflows (shared by you; none are created by AI HQ)",
      "n8n Cloud API key and base URL provided as server environment variables",
    ],
    todayLink: { href: "/automation", label: "Open Automation Center" },
  },
  settings: {
    id: "settings",
    title: "Settings",
    status: "partial",
    phase: 2,
    summary: "Account, environment and security settings.",
    availableToday: [
      "Read-only view of your account, environment and access policy.",
      "Sign out.",
    ],
    planned: [
      "Password change and multi-factor authentication",
      "Notification preferences",
      "Integration credentials status (never the values themselves)",
      "Data export",
    ],
    dependsOn: ["Supabase Auth MFA enabled for the project"],
  },
};
