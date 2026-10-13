import type { Database } from "@/lib/database.types";

/**
 * Demo dataset. Every record is flagged `is_demo` and named with a "[Demo] "
 * prefix, so it is recognisable in lists, figures and the activity log, and can
 * be removed in one step. Used by the in-app loader and by scripts/seed-dev.ts.
 */

type Tables = Database["public"]["Tables"];
type ProjectInsert = Omit<Tables["projects"]["Insert"], "owner_id" | "is_demo">;
type TaskInsert = Omit<Tables["tasks"]["Insert"], "owner_id" | "project_id" | "is_demo">;
type AutomationInsert = Omit<Tables["automations"]["Insert"], "owner_id" | "project_id" | "is_demo">;
type AgentInsert = Omit<Tables["agent_definitions"]["Insert"], "owner_id" | "is_demo">;
type AgentTaskInsert = Omit<Tables["agent_task_records"]["Insert"], "owner_id" | "agent_id" | "project_id" | "is_demo">;

export const DEMO_PREFIX = "[Demo] ";

function daysFromToday(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface DemoProject {
  project: ProjectInsert;
  tasks: TaskInsert[];
  automations: AutomationInsert[];
}

export interface DemoAgent {
  agent: AgentInsert;
  /** Index into DEMO_PROJECTS for the task's project link, if any. */
  tasks: Array<AgentTaskInsert & { projectIndex?: number }>;
}

export function demoProjects(): DemoProject[] {
  return [
    {
      project: {
        name: `${DEMO_PREFIX}AI HQ rollout`,
        description: "Sample project: bring the command center into daily use.",
        status: "active",
        category: "general",
        priority: "high",
        due_date: daysFromToday(21),
      },
      tasks: [
        { title: "Review access roles", status: "done", priority: "high" },
        { title: "Write the operations runbook", status: "in_progress", priority: "medium", due_date: daysFromToday(-1) },
        { title: "List existing n8n workflows to link in Phase 3", status: "todo", priority: "medium", due_date: daysFromToday(7) },
      ],
      automations: [
        {
          name: `${DEMO_PREFIX}Weekly project digest`,
          description: "Sample entry: summarise project progress every Monday.",
          trigger_type: "schedule",
          trigger_notes: "Every Monday 09:00",
          status: "draft",
        },
      ],
    },
    {
      project: {
        name: `${DEMO_PREFIX}Puzzle game soft launch`,
        description: "Sample game project.",
        status: "planning",
        category: "game",
        priority: "medium",
        due_date: daysFromToday(45),
      },
      tasks: [
        { title: "Fix crash on resume", status: "blocked", priority: "critical" },
        { title: "Prepare store listing", status: "todo", priority: "low" },
      ],
      automations: [],
    },
    {
      project: {
        name: `${DEMO_PREFIX}Subscription dashboard`,
        description: "Sample SaaS project.",
        status: "on_hold",
        category: "saas",
        priority: "medium",
      },
      tasks: [{ title: "Define pricing plans", status: "todo", priority: "high" }],
      automations: [],
    },
  ];
}

export function demoAgents(): DemoAgent[] {
  return [
    {
      agent: {
        name: `${DEMO_PREFIX}Research assistant`,
        description: "Sample agent: collects and summarises sources.",
        instructions: "You research a topic and return a short, sourced summary.",
        capabilities: ["research", "summarize"],
        status: "ready",
      },
      tasks: [{ title: "Summarise competitor landing pages", input: "Sample input", projectIndex: 2 }],
    },
    {
      agent: {
        name: `${DEMO_PREFIX}Release notes writer`,
        description: "Sample agent: drafts release notes from completed tasks.",
        instructions: "Write concise release notes from the list of completed tasks.",
        capabilities: ["write", "review"],
        status: "draft",
      },
      tasks: [],
    },
  ];
}
