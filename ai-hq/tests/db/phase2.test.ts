import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

const OWNER = "00000000-0000-4000-8000-00000000a11c";
const MEMBER = "00000000-0000-4000-8000-000000000b0b";
const OTHER = "00000000-0000-4000-8000-0000000ca201";

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  // Separate statements so the creation order (and therefore the owner) is deterministic.
  await db.exec(`
    delete from auth.users;
    update public.system_settings set workspace_name = 'AI HQ', timezone = 'UTC';
    delete from public.integration_configs;
    insert into auth.users (id, email, created_at) values ('${OWNER}', 'owner@example.test', now() - interval '2 hours');
    insert into auth.users (id, email, created_at) values ('${MEMBER}', 'member@example.test', now() - interval '1 hour');
    insert into auth.users (id, email, created_at) values ('${OTHER}', 'other@example.test', now());
  `);
});

async function createAgent(userId: string, status = "ready", name = "Researcher") {
  const [row] = await db.asUser(userId, (q) =>
    q.query<{ id: string; version: number }>(
      "insert into public.agent_definitions (name, instructions, status) values ($1, 'Summarise.', $2) returning id, version",
      [name, status],
    ),
  );
  return row;
}

async function queueTask(userId: string, agentId: string, title = "Weekly summary") {
  const [row] = await db.asUser(userId, (q) =>
    q.query<{ id: string; status: string; agent_version: number }>(
      "insert into public.agent_task_records (agent_id, title, input) values ($1, $2, 'Inputs') returning id, status, agent_version",
      [agentId, title],
    ),
  );
  return row;
}

describe("profiles and roles", () => {
  it("creates a profile per user and makes the first one the owner", async () => {
    const rows = await db.query<{ id: string; role: string; email: string }>(
      "select id, role, email from public.profiles order by created_at",
    );
    expect(rows.map((row) => row.role)).toEqual(["owner", "member", "member"]);
    expect(rows[0]).toMatchObject({ id: OWNER, email: "owner@example.test" });
  });

  it("keeps the profile email in sync with auth", async () => {
    await db.exec(`update auth.users set email = 'new@example.test' where id = '${MEMBER}'`);
    const [row] = await db.query<{ email: string }>("select email from public.profiles where id = $1", [MEMBER]);
    expect(row.email).toBe("new@example.test");
  });

  it("lets members see only their own profile while admins see everyone", async () => {
    const memberView = await db.asUser(MEMBER, (q) => q.query("select id from public.profiles"));
    expect(memberView).toEqual([{ id: MEMBER }]);
    const ownerView = await db.asUser(OWNER, (q) => q.query("select id from public.profiles"));
    expect(ownerView).toHaveLength(3);
  });

  it("allows editing the own display name but not the role", async () => {
    const [updated] = await db.asUser(MEMBER, (q) =>
      q.query<{ display_name: string }>(
        "update public.profiles set display_name = 'Bob' where id = $1 returning display_name",
        [MEMBER],
      ),
    );
    expect(updated.display_name).toBe("Bob");

    await expect(
      db.asUser(MEMBER, (q) => q.query("update public.profiles set role = 'owner' where id = $1", [MEMBER])),
    ).rejects.toThrow(/permission denied/);
    const foreign = await db.asUser(MEMBER, (q) =>
      q.query("update public.profiles set display_name = 'x' where id = $1 returning id", [OWNER]),
    );
    expect(foreign).toHaveLength(0);
  });

  it("only lets the owner change roles, and logs the change", async () => {
    await expect(
      db.asUser(MEMBER, (q) => q.query("select public.set_workspace_role($1, 'admin')", [MEMBER])),
    ).rejects.toThrow(/Only the workspace owner/);

    await db.asUser(OWNER, (q) => q.query("select public.set_workspace_role($1, 'admin')", [MEMBER]));
    const [row] = await db.query<{ role: string }>("select role from public.profiles where id = $1", [MEMBER]);
    expect(row.role).toBe("admin");

    // Admins manage settings but cannot hand out roles.
    await expect(
      db.asUser(MEMBER, (q) => q.query("select public.set_workspace_role($1, 'admin')", [OTHER])),
    ).rejects.toThrow(/Only the workspace owner/);

    const logs = await db.asUser(OWNER, (q) =>
      q.query<{ entity_type: string; summary: string }>(
        "select entity_type, summary from public.activity_logs where entity_type = 'profile'",
      ),
    );
    expect(logs).toEqual([{ entity_type: "profile", summary: "Role of member@example.test set to admin" }]);
  });

  it("never leaves the workspace without an owner", async () => {
    await expect(
      db.asUser(OWNER, (q) => q.query("select public.set_workspace_role($1, 'member')", [OWNER])),
    ).rejects.toThrow(/at least one owner/);
  });

  it("is not available to anonymous callers", async () => {
    await expect(
      db.asAnon((q) => q.query("select public.set_workspace_role($1, 'owner')", [MEMBER])),
    ).rejects.toThrow(/permission denied/);
    await expect(db.asAnon((q) => q.query("select * from public.profiles"))).rejects.toThrow(/permission denied/);
  });
});

describe("system settings", () => {
  it("is readable by every signed-in user", async () => {
    const rows = await db.asUser(MEMBER, (q) => q.query("select workspace_name, timezone from public.system_settings"));
    expect(rows).toEqual([{ workspace_name: "AI HQ", timezone: "UTC" }]);
  });

  it("can only be changed by admins", async () => {
    const memberUpdate = await db.asUser(MEMBER, (q) =>
      q.query("update public.system_settings set workspace_name = 'Hijack' returning id"),
    );
    expect(memberUpdate).toHaveLength(0);

    const [row] = await db.asUser(OWNER, (q) =>
      q.query<{ workspace_name: string; timezone: string; updated_by: string }>(
        "update public.system_settings set workspace_name = 'Tamga HQ', timezone = 'Europe/Istanbul' returning workspace_name, timezone, updated_by",
      ),
    );
    expect(row).toEqual({ workspace_name: "Tamga HQ", timezone: "Europe/Istanbul", updated_by: OWNER });
  });

  it("rejects unknown time zones and extra rows", async () => {
    await expect(
      db.asUser(OWNER, (q) => q.query("update public.system_settings set timezone = 'Mars/Olympus'")),
    ).rejects.toThrow(/time zone/);
    await expect(
      db.asUser(OWNER, (q) => q.query("insert into public.system_settings (id) values (true)")),
    ).rejects.toThrow(/permission denied/);
    await expect(db.asUser(OWNER, (q) => q.query("delete from public.system_settings"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("computes 'today' in the workspace time zone", async () => {
    await db.asUser(OWNER, (q) => q.query("update public.system_settings set timezone = 'Pacific/Kiritimati'"));
    const [row] = await db.asUser(MEMBER, (q) =>
      q.query<{ ok: boolean }>(
        "select public.workspace_today() = (now() at time zone 'Pacific/Kiritimati')::date as ok",
      ),
    );
    expect(row.ok).toBe(true);
  });

  it("logs which settings changed without their values", async () => {
    await db.asUser(OWNER, (q) => q.query("update public.system_settings set timezone = 'Europe/Istanbul'"));
    const [log] = await db.asUser(OWNER, (q) =>
      q.query<{ entity_type: string; entity_id: string | null; metadata: Record<string, unknown> }>(
        "select entity_type, entity_id, metadata from public.activity_logs where entity_type = 'system_settings'",
      ),
    );
    expect(log).toEqual({ entity_type: "system_settings", entity_id: null, metadata: { changed: ["timezone"] } });
  });
});

describe("integration configurations", () => {
  it("lets admins write non-secret settings and members only read them", async () => {
    await expect(
      db.asUser(MEMBER, (q) =>
        q.query("insert into public.integration_configs (key, enabled, settings) values ('n8n', true, '{}')"),
      ),
    ).rejects.toThrow(/row-level security/);

    await db.asUser(OWNER, (q) =>
      q.query(
        `insert into public.integration_configs (key, enabled, settings)
         values ('n8n', true, '{"baseUrl":"https://acme.app.n8n.cloud"}')`,
      ),
    );
    const memberView = await db.asUser(MEMBER, (q) => q.query("select key, enabled from public.integration_configs"));
    expect(memberView).toEqual([{ key: "n8n", enabled: true }]);

    const memberUpdate = await db.asUser(MEMBER, (q) =>
      q.query("update public.integration_configs set enabled = false returning key"),
    );
    expect(memberUpdate).toHaveLength(0);
  });

  it("does not let anyone but a connector record a connection test", async () => {
    await db.asUser(OWNER, (q) => q.query("insert into public.integration_configs (key) values ('n8n')"));
    await expect(
      db.asUser(OWNER, (q) =>
        q.query("update public.integration_configs set last_test_status = 'succeeded' where key = 'n8n'"),
      ),
    ).rejects.toThrow(/permission denied/);

    // A future server-side connector (service role) can.
    await db.asService((q) =>
      q.query("update public.integration_configs set last_test_status = 'failed', last_tested_at = now() where key = 'n8n'"),
    );
    const [row] = await db.query<{ last_test_status: string }>(
      "select last_test_status from public.integration_configs where key = 'n8n'",
    );
    expect(row.last_test_status).toBe("failed");
  });

  it("validates keys and logs changes without setting values", async () => {
    await expect(
      db.asUser(OWNER, (q) => q.query("insert into public.integration_configs (key) values ('Bad Key!')")),
    ).rejects.toThrow(/check constraint/);

    await db.asUser(OWNER, (q) =>
      q.query(`insert into public.integration_configs (key, settings) values ('anthropic', '{"defaultModel":"x"}')`),
    );
    await db.asUser(OWNER, (q) =>
      q.query(`update public.integration_configs set settings = '{"defaultModel":"y"}' where key = 'anthropic'`),
    );
    const logs = await db.asUser(OWNER, (q) =>
      q.query<{ action: string; metadata: Record<string, unknown> }>(
        "select action, metadata from public.activity_logs where entity_type = 'integration' order by id",
      ),
    );
    expect(logs).toEqual([
      { action: "created", metadata: { key: "anthropic" } },
      { action: "updated", metadata: { key: "anthropic", changed: ["settings"] } },
    ]);
    expect(JSON.stringify(logs)).not.toContain("defaultModel");
  });
});

describe("agent definitions", () => {
  it("are private to their owner", async () => {
    await createAgent(OWNER);
    expect(await db.asUser(MEMBER, (q) => q.query("select id from public.agent_definitions"))).toHaveLength(0);
  });

  it("bump their version only when behaviour changes", async () => {
    const agent = await createAgent(OWNER);
    expect(agent.version).toBe(1);
    const [renamed] = await db.asUser(OWNER, (q) =>
      q.query<{ version: number }>("update public.agent_definitions set name = 'Analyst' where id = $1 returning version", [
        agent.id,
      ]),
    );
    expect(renamed.version).toBe(1);
    const [changed] = await db.asUser(OWNER, (q) =>
      q.query<{ version: number }>(
        "update public.agent_definitions set instructions = 'Analyse.' where id = $1 returning version",
        [agent.id],
      ),
    );
    expect(changed.version).toBe(2);
  });
});

describe("agent task records", () => {
  it("can only be queued for ready agents", async () => {
    const draft = await createAgent(OWNER, "draft");
    await expect(queueTask(OWNER, draft.id)).rejects.toThrow(/must be Ready/);

    const ready = await createAgent(OWNER, "ready", "Writer");
    const task = await queueTask(OWNER, ready.id);
    expect(task).toMatchObject({ status: "queued", agent_version: 1 });
  });

  it("cannot be queued on someone else's agent", async () => {
    const agent = await createAgent(OWNER);
    await expect(queueTask(MEMBER, agent.id)).rejects.toThrow(/foreign key/);
  });

  it("cannot be created or completed with fabricated results by users", async () => {
    const agent = await createAgent(OWNER);
    await expect(
      db.asUser(OWNER, (q) =>
        q.query(
          "insert into public.agent_task_records (agent_id, title, status, output) values ($1, 'x', 'succeeded', 'done')",
          [agent.id],
        ),
      ),
    ).rejects.toThrow(/start as queued/);

    const task = await queueTask(OWNER, agent.id);
    await expect(
      db.asUser(OWNER, (q) => q.query("update public.agent_task_records set status = 'succeeded' where id = $1", [task.id])),
    ).rejects.toThrow(/only be cancelled/);
    await expect(
      db.asUser(OWNER, (q) => q.query("update public.agent_task_records set output = 'fake' where id = $1", [task.id])),
    ).rejects.toThrow(/Only the agent runtime/);
  });

  it("can be cancelled while queued, once", async () => {
    const agent = await createAgent(OWNER);
    const task = await queueTask(OWNER, agent.id);
    const [cancelled] = await db.asUser(OWNER, (q) =>
      q.query<{ status: string; completed_at: Date | null }>(
        "update public.agent_task_records set status = 'cancelled' where id = $1 returning status, completed_at",
        [task.id],
      ),
    );
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.completed_at).not.toBeNull();
    await expect(
      db.asUser(OWNER, (q) => q.query("update public.agent_task_records set status = 'queued' where id = $1", [task.id])),
    ).rejects.toThrow(/only be cancelled/);
  });

  it("accepts results from the runtime (service role) and then freezes for users", async () => {
    const agent = await createAgent(OWNER);
    const task = await queueTask(OWNER, agent.id);
    await db.asService((q) =>
      q.query(
        "update public.agent_task_records set status = 'succeeded', output = 'Report', started_at = now(), completed_at = now() where id = $1",
        [task.id],
      ),
    );
    await expect(
      db.asUser(OWNER, (q) => q.query("update public.agent_task_records set title = 'Edited' where id = $1", [task.id])),
    ).rejects.toThrow(/Only queued tasks/);
  });

  it("are unlinked from deleted projects even after completion, and removed with their agent", async () => {
    const [project] = await db.asUser(OWNER, (q) =>
      q.query<{ id: string }>("insert into public.projects (name) values ('Ops') returning id"),
    );
    const agent = await createAgent(OWNER);
    const [task] = await db.asUser(OWNER, (q) =>
      q.query<{ id: string }>(
        "insert into public.agent_task_records (agent_id, project_id, title) values ($1, $2, 'Linked') returning id",
        [agent.id, project.id],
      ),
    );
    await db.asService((q) => q.query("update public.agent_task_records set status = 'succeeded' where id = $1", [task.id]));

    await db.asUser(OWNER, (q) => q.query("delete from public.projects where id = $1", [project.id]));
    const [unlinked] = await db.query<{ project_id: string | null }>(
      "select project_id from public.agent_task_records where id = $1",
      [task.id],
    );
    expect(unlinked.project_id).toBeNull();

    await db.asUser(OWNER, (q) => q.query("delete from public.agent_definitions where id = $1", [agent.id]));
    const [{ count }] = await db.query<{ count: number }>("select count(*)::int as count from public.agent_task_records");
    expect(count).toBe(0);
    const deletions = await db.query<{ entity_type: string }>(
      "select entity_type from public.activity_logs where action = 'deleted' and entity_type in ('agent', 'agent_task')",
    );
    expect(deletions).toEqual([{ entity_type: "agent" }]);
  });
});

describe("demo data separation", () => {
  it("keeps demo records out of the figures unless asked", async () => {
    await db.asUser(OWNER, (q) =>
      q.query(`
        insert into public.projects (name, status, is_demo) values ('Real', 'active', false), ('[Demo] Sample', 'active', true)
      `),
    );
    const [{ real }] = await db.asUser(OWNER, (q) =>
      q.query<{ real: Record<string, number> }>("select public.command_center_summary() as real"),
    );
    const [{ all }] = await db.asUser(OWNER, (q) =>
      q.query<{ all: Record<string, number> }>("select public.command_center_summary(true) as all"),
    );
    expect(real).toMatchObject({ projects_active: 1, demo_records: 1 });
    expect(all).toMatchObject({ projects_active: 2, demo_records: 1 });

    const overview = await db.asUser(OWNER, (q) =>
      q.query<{ name: string; is_demo: boolean }>("select name, is_demo from public.project_overview order by is_demo, name"),
    );
    expect(overview).toEqual([
      { name: "Real", is_demo: false },
      { name: "[Demo] Sample", is_demo: true },
    ]);
  });
});

describe("anonymous access to Phase 2 objects", () => {
  it.each(["profiles", "system_settings", "integration_configs", "agent_definitions", "agent_task_records"])(
    "cannot read public.%s",
    async (table) => {
      await expect(db.asAnon((q) => q.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    },
  );
});
