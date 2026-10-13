/**
 * Seeds DEVELOPMENT data: one dev user plus demo projects, tasks and an
 * automation entry. Refuses to run unless APP_ENV=development and the target is
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
import { resolveSeedTarget, SeedRefusedError } from "./lib/seed-guard";

const DEMO_PREFIX = "[Demo] ";

for (const file of [".env.development.local", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

function isoDate(daysFromToday: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
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

  // 2. Demo data, tagged with a prefix so it is easy to recognise and remove.
  const { data: existing, error: existingError } = await admin
    .from("projects")
    .select("id")
    .eq("owner_id", ownerId)
    .like("name", `${DEMO_PREFIX}%`);
  if (existingError) throw existingError;

  if (existing.length > 0 && !reset) {
    console.log("Demo data already present. Run with --reset to recreate it.");
  } else {
    if (existing.length > 0) {
      const { error } = await admin.from("projects").delete().in("id", existing.map((project) => project.id));
      if (error) throw error;
      const { error: automationError } = await admin
        .from("automations")
        .delete()
        .eq("owner_id", ownerId)
        .like("name", `${DEMO_PREFIX}%`);
      if (automationError) throw automationError;
    }

    const { data: projects, error: projectError } = await admin
      .from("projects")
      .insert([
        {
          owner_id: ownerId,
          name: `${DEMO_PREFIX}AI HQ foundation`,
          description: "Sample project created by the development seed.",
          status: "active",
          category: "general",
          priority: "high",
          due_date: isoDate(14),
        },
        {
          owner_id: ownerId,
          name: `${DEMO_PREFIX}Puzzle game soft launch`,
          description: "Sample game project.",
          status: "planning",
          category: "game",
          priority: "medium",
          due_date: isoDate(45),
        },
      ])
      .select("id, name");
    if (projectError) throw projectError;

    const [foundation, game] = projects;
    const { error: taskError } = await admin.from("tasks").insert([
      { owner_id: ownerId, project_id: foundation.id, title: "Review RLS policies", status: "done", priority: "high" },
      { owner_id: ownerId, project_id: foundation.id, title: "Connect existing n8n workflows (Phase 2)", status: "todo", priority: "medium", due_date: isoDate(10) },
      { owner_id: ownerId, project_id: foundation.id, title: "Write runbook", status: "in_progress", priority: "medium", due_date: isoDate(-1) },
      { owner_id: ownerId, project_id: game.id, title: "Prepare store listing", status: "todo", priority: "low" },
      { owner_id: ownerId, project_id: game.id, title: "Fix crash on resume", status: "blocked", priority: "critical" },
    ]);
    if (taskError) throw taskError;

    const { error: automationError } = await admin.from("automations").insert({
      owner_id: ownerId,
      project_id: foundation.id,
      name: `${DEMO_PREFIX}Weekly project digest`,
      description: "Sample catalogue entry. Not linked to any n8n workflow.",
      trigger_type: "schedule",
      trigger_notes: "Every Monday 09:00",
      status: "draft",
    });
    if (automationError) throw automationError;
    console.log("Inserted demo projects, tasks and an automation entry.");
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
