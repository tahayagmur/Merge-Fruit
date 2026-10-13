import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, migrationFiles, type TestDatabase } from "./harness";

const ROLLBACK = path.resolve(__dirname, "../../supabase/rollback/20261014120000_phase2_core_down.sql");
const PHASE2 = migrationFiles().find((file) => file.includes("phase2_core"))!;
const USER = "00000000-0000-4000-8000-00000000a11c";

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.exec(`delete from auth.users; insert into auth.users (id, email) values ('${USER}', 'owner@example.test');`);
  await db.asUser(USER, (q) =>
    q.query("insert into public.automations (name, provider, external_workflow_id) values ('Digest', 'n8n', 'wf_1')"),
  );
});

afterAll(async () => {
  await db?.close();
});

describe("phase 2 rollback script", () => {
  it("restores the Phase 1 schema and keeps Phase 1 data", async () => {
    await db.exec(readFileSync(ROLLBACK, "utf8"));

    const tables = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name in ('profiles','system_settings','integration_configs','agent_definitions','agent_task_records')`,
    );
    expect(tables).toEqual([]);

    const [automation] = await db.query<{ n8n_workflow_id: string }>("select n8n_workflow_id from public.automations");
    expect(automation.n8n_workflow_id).toBe("wf_1");

    const [{ summary }] = await db.asUser(USER, (q) =>
      q.query<{ summary: Record<string, number> }>("select public.command_center_summary() as summary"),
    );
    expect(summary.automations_total).toBe(1);
    await db.asUser(USER, (q) => q.query("insert into public.projects (name) values ('Still works') returning id"));
  });

  it("can be re-applied after a rollback", async () => {
    await db.exec(readFileSync(PHASE2, "utf8"));
    const [profile] = await db.query<{ role: string }>("select role from public.profiles where id = $1", [USER]);
    expect(profile.role).toBe("owner");
    const [automation] = await db.query<{ provider: string; external_workflow_id: string }>(
      "select provider, external_workflow_id from public.automations",
    );
    expect(automation).toEqual({ provider: "n8n", external_workflow_id: "wf_1" });
  });
});
