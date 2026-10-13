import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

const OWNER = "00000000-0000-4000-8000-00000000a11c";
const MEMBER = "00000000-0000-4000-8000-000000000b0b";
const ADMIN = "00000000-0000-4000-8000-0000000ca201";
const AUDIT = path.resolve(__dirname, "../../supabase/migrations/20261015120000_workspace_audit.sql");
const AUDIT_DOWN = path.resolve(__dirname, "../../supabase/rollback/20261015120000_workspace_audit_down.sql");

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    delete from auth.users;
    insert into auth.users (id, email, created_at) values ('${OWNER}', 'owner@example.test', now() - interval '2 hours');
    insert into auth.users (id, email, created_at) values ('${MEMBER}', 'member@example.test', now() - interval '1 hour');
    insert into auth.users (id, email, created_at) values ('${ADMIN}', 'admin@example.test', now());
  `);
  await db.asUser(OWNER, (q) => q.query("select public.set_workspace_role($1, 'admin')", [ADMIN]));
  await db.asUser(MEMBER, (q) => q.query("insert into public.projects (name) values ('Member project')"));
  await db.asUser(OWNER, (q) => q.query("insert into public.projects (name) values ('Owner project')"));
});

const summaries = (userId: string) =>
  db
    .asUser(userId, (q) => q.query<{ summary: string }>("select summary from public.activity_logs order by id"))
    .then((rows) => rows.map((row) => row.summary));

describe("workspace audit view", () => {
  it("lets owners and admins read every entry", async () => {
    for (const reader of [OWNER, ADMIN]) {
      const rows = await summaries(reader);
      expect(rows).toContain("Project created: Member project");
      expect(rows).toContain("Project created: Owner project");
      expect(rows).toContain("Role of admin@example.test set to admin");
    }
  });

  it("keeps members to their own entries", async () => {
    expect(await summaries(MEMBER)).toEqual(["Project created: Member project"]);
  });

  it("stays read-only for admins too", async () => {
    for (const statement of [
      "insert into public.activity_logs (owner_id, entity_type, entity_id, action, summary) values (auth.uid(), 'project', gen_random_uuid(), 'created', 'forged')",
      "update public.activity_logs set summary = 'rewritten'",
      "delete from public.activity_logs",
    ]) {
      await expect(db.asUser(OWNER, (q) => q.query(statement))).rejects.toThrow(/permission denied/);
    }
  });

  it("follows role changes immediately", async () => {
    await db.asUser(OWNER, (q) => q.query("select public.set_workspace_role($1, 'member')", [ADMIN]));
    expect(await summaries(ADMIN)).toEqual([]);
  });

  it("is removed by its rollback script and can be re-applied", async () => {
    await db.exec(readFileSync(AUDIT_DOWN, "utf8"));
    expect(await summaries(OWNER)).not.toContain("Project created: Member project");
    await db.exec(readFileSync(AUDIT, "utf8"));
    expect(await summaries(OWNER)).toContain("Project created: Member project");
  });
});
