/**
 * Seeds DEVELOPMENT data: one dev user plus the labelled demo dataset
 * (src/lib/demo/dataset.ts). Refuses to run unless APP_ENV=development and the target is
 * a local Supabase or the project named in DEV_SUPABASE_PROJECT_REF.
 *
 *   npm run db:seed:dev            # create user + demo data (skips if present)
 *   npm run db:seed:dev -- --reset # replace the demo data
 *
 * Reads .env.development.local, then .env.local, when present.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { demoAgents, demoProjects } from "../src/lib/demo/dataset";
import { resolveSeedTarget, SeedRefusedError } from "./lib/seed-guard";

for (const file of [".env.development.local", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

async function main() {
  const target = resolveSeedTarget(process.env);
  const reset = process.argv.includes("--reset");
  const admin = createClient<Database>(target.supabaseUrl, target.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Development user (created through the Auth admin API, never via SQL).
  let generatedPassword: string | null = null;
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  let user = list.users.find((candidate) => candidate.email?.toLowerCase() === target.email);
  if (!user) {
    const password = target.password ?? (generatedPassword = `Dev-${randomBytes(12).toString("base64url")}9a`);
    const { data, error } = await admin.auth.admin.createUser({ email: target.email, password, email_confirm: true });
    if (error) throw error;
    user = data.user;
    console.log(`Created development user ${target.email}`);
  } else {
    console.log(`Using existing development user ${target.email}`);
  }
  const ownerId = user.id;

  // 2. Demo data: the same labelled dataset the in-app loader uses (is_demo = true, "[Demo] " prefix).
  // The secret key bypasses RLS, so every query is scoped to the development user explicitly.
  const DEMO_TABLES = ["agent_task_records", "agent_definitions", "automations", "tasks", "projects"] as const;
  const { count, error: countError } = await admin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("is_demo", true);
  if (countError) throw countError;

  if ((count ?? 0) > 0 && !reset) {
    console.log("Demo data already present. Run with --reset to recreate it.");
  } else {
    for (const table of DEMO_TABLES) {
      const { error } = await admin.from(table).delete().eq("owner_id", ownerId).eq("is_demo", true);
      if (error) throw error;
    }

    const projectIds: string[] = [];
    for (const demo of demoProjects()) {
      const { data: project, error } = await admin
        .from("projects")
        .insert({ ...demo.project, owner_id: ownerId, is_demo: true })
        .select("id")
        .single();
      if (error) throw error;
      projectIds.push(project.id);
      if (demo.tasks.length > 0) {
        const { error: taskError } = await admin
          .from("tasks")
          .insert(demo.tasks.map((task) => ({ ...task, owner_id: ownerId, project_id: project.id, is_demo: true })));
        if (taskError) throw taskError;
      }
      if (demo.automations.length > 0) {
        const { error: automationError } = await admin
          .from("automations")
          .insert(demo.automations.map((item) => ({ ...item, owner_id: ownerId, project_id: project.id, is_demo: true })));
        if (automationError) throw automationError;
      }
    }

    for (const demo of demoAgents()) {
      const { data: agent, error } = await admin
        .from("agent_definitions")
        .insert({ ...demo.agent, owner_id: ownerId, is_demo: true })
        .select("id")
        .single();
      if (error) throw error;
      if (demo.tasks.length > 0) {
        const { error: taskError } = await admin.from("agent_task_records").insert(
          demo.tasks.map(({ projectIndex, ...task }) => ({
            ...task,
            owner_id: ownerId,
            agent_id: agent.id,
            project_id: projectIndex === undefined ? null : (projectIds[projectIndex] ?? null),
            is_demo: true,
          })),
        );
        if (taskError) throw taskError;
      }
    }
    console.log("Inserted the demo dataset (projects, tasks, automations, agents, agent tasks).");
  }

  if (generatedPassword) {
    console.log(`\nGenerated password for ${target.email} (shown once, store it in your password manager):\n  ${generatedPassword}`);
  }
  console.log(
    "\nIf AI_HQ_ALLOWED_EMAILS is set, add this email to it before signing in.",
  );
}

main().catch((error) => {
  if (error instanceof SeedRefusedError) {
    console.error(error.message);
  } else {
    console.error("Seeding failed:", error instanceof Error ? error.message : error);
  }
  process.exit(1);
});
