import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

const ALICE = "00000000-0000-4000-8000-00000000a11c";
const BOB = "00000000-0000-4000-8000-000000000b0b";

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
    insert into auth.users (id, email) values
      ('${ALICE}', 'alice@example.test'),
      ('${BOB}', 'bob@example.test');
  `);
});

async function createProject(userId: string, name = "Launch AI HQ") {
  const [row] = await db.asUser(userId, (q) =>
    q.query<{ id: string; owner_id: string }>(
      "insert into public.projects (name) values ($1) returning id, owner_id",
      [name],
    ),
  );
  return row;
}

async function createTask(userId: string, projectId: string, title = "Wire up auth") {
  const [row] = await db.asUser(userId, (q) =>
    q.query<{ id: string }>(
      "insert into public.tasks (project_id, title) values ($1, $2) returning id",
      [projectId, title],
    ),
  );
  return row;
}

describe("anonymous access", () => {
  it.each(["projects", "tasks", "automations", "activity_logs", "project_overview"])(
    "cannot read public.%s",
    async (table) => {
      await expect(db.asAnon((q) => q.query(`select * from public.${table}`))).rejects.toThrow(
        /permission denied/,
      );
    },
  );

  it("cannot insert projects", async () => {
    await expect(
      db.asAnon((q) => q.query(`insert into public.projects (owner_id, name) values ($1, 'x')`, [ALICE])),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot call command_center_summary()", async () => {
    await expect(db.asAnon((q) => q.query("select public.command_center_summary()"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("project ownership", () => {
  it("defaults owner_id to the authenticated user", async () => {
    const project = await createProject(ALICE);
    expect(project.owner_id).toBe(ALICE);
  });

  it("hides other users' projects", async () => {
    await createProject(ALICE);
    const rows = await db.asUser(BOB, (q) => q.query("select id from public.projects"));
    expect(rows).toHaveLength(0);
  });

  it("does not let another user update or delete a project", async () => {
    const project = await createProject(ALICE, "Original");

    const updated = await db.asUser(BOB, (q) =>
      q.query("update public.projects set name = 'Hijacked' where id = $1 returning id", [project.id]),
    );
    const deleted = await db.asUser(BOB, (q) =>
      q.query("delete from public.projects where id = $1 returning id", [project.id]),
    );

    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
    const [row] = await db.query<{ name: string }>("select name from public.projects where id = $1", [
      project.id,
    ]);
    expect(row.name).toBe("Original");
  });

  it("rejects inserting a project on behalf of another user", async () => {
    await expect(
      db.asUser(BOB, (q) =>
        q.query("insert into public.projects (owner_id, name) values ($1, 'Spoofed')", [ALICE]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("rejects transferring a project to another user", async () => {
    const project = await createProject(ALICE);
    await expect(
      db.asUser(ALICE, (q) => q.query("update public.projects set owner_id = $1 where id = $2", [BOB, project.id])),
    ).rejects.toThrow(/row-level security/);
  });

  it("enforces name constraints", async () => {
    await expect(createProject(ALICE, "   ")).rejects.toThrow(/check constraint/);
    await expect(createProject(ALICE, "x".repeat(121))).rejects.toThrow(/check constraint/);
  });
});

describe("task ownership", () => {
  it("rejects a task in another user's project", async () => {
    const project = await createProject(ALICE);

    // Owned by Bob but pointing at Alice's project: composite FK fails.
    await expect(createTask(BOB, project.id)).rejects.toThrow(/foreign key/);
    // Claiming to be Alice: RLS fails.
    await expect(
      db.asUser(BOB, (q) =>
        q.query("insert into public.tasks (project_id, owner_id, title) values ($1, $2, 'x')", [
          project.id,
          ALICE,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("hides other users' tasks", async () => {
    const project = await createProject(ALICE);
    await createTask(ALICE, project.id);
    const rows = await db.asUser(BOB, (q) => q.query("select id from public.tasks"));
    expect(rows).toHaveLength(0);
  });

  it("sets completed_at when a task is done and clears it when reopened", async () => {
    const project = await createProject(ALICE);
    const task = await createTask(ALICE, project.id);

    const [done] = await db.asUser(ALICE, (q) =>
      q.query<{ completed_at: Date | null }>(
        "update public.tasks set status = 'done' where id = $1 returning completed_at",
        [task.id],
      ),
    );
    expect(done.completed_at).not.toBeNull();

    const [reopened] = await db.asUser(ALICE, (q) =>
      q.query<{ completed_at: Date | null }>(
        "update public.tasks set status = 'in_progress' where id = $1 returning completed_at",
        [task.id],
      ),
    );
    expect(reopened.completed_at).toBeNull();
  });
});

describe("activity logs", () => {
  it("records changes and attributes them to the actor", async () => {
    const project = await createProject(ALICE, "Command Center");
    const task = await createTask(ALICE, project.id, "Design sidebar");
    await db.asUser(ALICE, (q) => q.query("update public.tasks set status = 'done' where id = $1", [task.id]));

    const logs = await db.asUser(ALICE, (q) =>
      q.query<{ entity_type: string; action: string; actor_id: string; summary: string; metadata: Record<string, unknown> }>(
        "select entity_type, action, actor_id, summary, metadata from public.activity_logs order by id",
      ),
    );

    expect(logs.map((log) => `${log.entity_type}.${log.action}`)).toEqual([
      "project.created",
      "task.created",
      "task.status_changed",
    ]);
    expect(logs.every((log) => log.actor_id === ALICE)).toBe(true);
    expect(logs[2].metadata).toMatchObject({ from: "todo", to: "done", project_id: project.id });
    expect(logs[2].summary).toBe("Task Design sidebar: todo -> done");
  });

  it("skips updates that change nothing meaningful", async () => {
    const project = await createProject(ALICE, "Same");
    await db.asUser(ALICE, (q) => q.query("update public.projects set name = 'Same' where id = $1", [project.id]));
    const [{ count }] = await db.query<{ count: number }>(
      "select count(*)::int as count from public.activity_logs where entity_id = $1",
      [project.id],
    );
    expect(count).toBe(1);
  });

  it("is invisible to other users", async () => {
    await createProject(ALICE);
    const rows = await db.asUser(BOB, (q) => q.query("select id from public.activity_logs"));
    expect(rows).toHaveLength(0);
  });

  it("cannot be written, edited or deleted by users", async () => {
    const project = await createProject(ALICE);

    await expect(
      db.asUser(ALICE, (q) =>
        q.query(
          `insert into public.activity_logs (owner_id, entity_type, entity_id, action, summary)
           values ($1, 'project', $2, 'created', 'forged')`,
          [ALICE, project.id],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.asUser(ALICE, (q) => q.query("update public.activity_logs set summary = 'edited'")),
    ).rejects.toThrow(/permission denied/);
    await expect(db.asUser(ALICE, (q) => q.query("delete from public.activity_logs"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("logs a single entry when a project and its tasks are deleted", async () => {
    const project = await createProject(ALICE, "Temporary");
    await createTask(ALICE, project.id, "One");
    await createTask(ALICE, project.id, "Two");

    await db.asUser(ALICE, (q) => q.query("delete from public.projects where id = $1", [project.id]));

    const deletions = await db.query<{ entity_type: string }>(
      "select entity_type from public.activity_logs where action = 'deleted'",
    );
    expect(deletions).toEqual([{ entity_type: "project" }]);
    const [{ count }] = await db.query<{ count: number }>("select count(*)::int as count from public.tasks");
    expect(count).toBe(0);
  });
});

describe("automations", () => {
  it("keeps the automation but unlinks it when its project is deleted", async () => {
    const project = await createProject(ALICE);
    const [automation] = await db.asUser(ALICE, (q) =>
      q.query<{ id: string }>(
        "insert into public.automations (name, project_id) values ('Weekly report', $1) returning id",
        [project.id],
      ),
    );

    await db.asUser(ALICE, (q) => q.query("delete from public.projects where id = $1", [project.id]));

    const [row] = await db.asUser(ALICE, (q) =>
      q.query<{ project_id: string | null; owner_id: string }>(
        "select project_id, owner_id from public.automations where id = $1",
        [automation.id],
      ),
    );
    expect(row).toEqual({ project_id: null, owner_id: ALICE });
  });

  it("rejects linking to another user's project", async () => {
    const project = await createProject(ALICE);
    await expect(
      db.asUser(BOB, (q) =>
        q.query("insert into public.automations (name, project_id) values ('x', $1)", [project.id]),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("only accepts identifier-shaped n8n workflow ids", async () => {
    await expect(
      db.asUser(ALICE, (q) =>
        q.query("insert into public.automations (name, n8n_workflow_id) values ('x', $1)", [
          "https://example.test/webhook/123",
        ]),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("read models", () => {
  it("project_overview only aggregates the caller's data", async () => {
    const project = await createProject(ALICE);
    const first = await createTask(ALICE, project.id, "One");
    await createTask(ALICE, project.id, "Two");
    await db.asUser(ALICE, (q) => q.query("update public.tasks set status = 'done' where id = $1", [first.id]));

    const [overview] = await db.asUser(ALICE, (q) =>
      q.query<{ task_total: number; task_done: number }>(
        "select task_total, task_done from public.project_overview where id = $1",
        [project.id],
      ),
    );
    expect(overview).toEqual({ task_total: 2, task_done: 1 });

    const bobRows = await db.asUser(BOB, (q) => q.query("select id from public.project_overview"));
    expect(bobRows).toHaveLength(0);
  });

  it("command_center_summary() counts only the caller's rows", async () => {
    const project = await createProject(ALICE);
    await db.asUser(ALICE, (q) => q.query("update public.projects set status = 'active' where id = $1", [project.id]));
    await createTask(ALICE, project.id);
    await db.asUser(ALICE, (q) =>
      q.query("insert into public.tasks (project_id, title, due_date) values ($1, 'Late', current_date - 1)", [
        project.id,
      ]),
    );

    const [{ summary: alice }] = await db.asUser(ALICE, (q) =>
      q.query<{ summary: Record<string, number> }>("select public.command_center_summary() as summary"),
    );
    const [{ summary: bob }] = await db.asUser(BOB, (q) =>
      q.query<{ summary: Record<string, number> }>("select public.command_center_summary() as summary"),
    );

    expect(alice).toMatchObject({ projects_total: 1, projects_active: 1, tasks_open: 2, tasks_overdue: 1 });
    expect(bob).toMatchObject({ projects_total: 0, projects_active: 0, tasks_open: 0, tasks_overdue: 0 });
  });
});

describe("account deletion", () => {
  it("removes all of the user's data without tripping the activity trigger", async () => {
    const project = await createProject(ALICE);
    await createTask(ALICE, project.id);

    await db.exec(`delete from auth.users where id = '${ALICE}'`);

    const [{ projects, tasks, logs }] = await db.query<{ projects: number; tasks: number; logs: number }>(
      `select (select count(*)::int from public.projects) as projects,
              (select count(*)::int from public.tasks) as tasks,
              (select count(*)::int from public.activity_logs) as logs`,
    );
    expect({ projects, tasks, logs }).toEqual({ projects: 0, tasks: 0, logs: 0 });
  });
});
