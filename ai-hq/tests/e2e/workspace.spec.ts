import { expect, test } from "@playwright/test";
import { USERS } from "./support/fixtures";
import { choose, signIn, uniqueName } from "./support/helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, USERS.alice);
});

test("sidebar navigation reaches every section", async ({ page }) => {
  const sections: Array<[string, string, string]> = [
    ["Projects", "/projects", "Projects"],
    ["Automation Center", "/automation", "Automations"],
    ["Game Studio", "/game-studio", "Game Studio"],
    ["SaaS & Business", "/saas", "SaaS & Business"],
    ["AI Agent Hub", "/agents", "Agents"],
    ["Integrations", "/integrations", "Integrations"],
    ["Activity Logs", "/activity", "Activity"],
    ["Settings", "/settings", "Settings"],
    ["Command Center", "/", "Mission overview"],
  ];
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const [link, path, heading] of sections) {
    await nav.getByRole("link", { name: new RegExp(`^${link.replace(/[&]/g, "\\$&")}`) }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(nav.getByRole("link", { name: new RegExp(`^${link}`) })).toHaveAttribute("aria-current", "page");
  }
});

test("projects and tasks are created, updated and persisted", async ({ page }) => {
  const name = uniqueName("Launch AI HQ");

  // Validation errors come back from the API and show inline.
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText("Name is required.")).toBeVisible();

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Description").fill("Phase 1 foundation");
  await choose(page, "Status", "Active");
  await page.getByLabel("Due date").fill("2030-01-31");
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const projectUrl = page.url();

  for (const title of ["Design sidebar", "Write RLS tests"]) {
    await page.getByLabel("New task title").fill(title);
    await page.getByLabel("New task title").press("Enter");
    await expect(page.getByTestId("task-card").filter({ hasText: title })).toBeVisible();
  }

  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "PATCH" && response.ok()),
    choose(page, "Status of Design sidebar", "Done"),
  ]);
  await expect(page.getByRole("region", { name: "Done" }).getByText("Design sidebar")).toBeVisible();
  await expect(page.getByText("1/2 · 50%")).toBeVisible();

  // Edit a task through its menu.
  await page.getByRole("button", { name: "Actions for Write RLS tests" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit task" });
  await dialog.getByLabel("Title").fill("Write RLS and auth tests");
  await choose(page, "Priority", "Critical");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("task-card").filter({ hasText: "Write RLS and auth tests" })).toContainText("Critical");

  // Everything survives a full reload: it is stored in the database.
  await page.goto(projectUrl);
  await expect(page.getByRole("region", { name: "Done" }).getByText("Design sidebar")).toBeVisible();
  await expect(page.getByTestId("task-card").filter({ hasText: "Write RLS and auth tests" })).toBeVisible();
  await expect(page.getByText("Task Design sidebar: todo -> done")).toBeVisible();
  await expect(page.getByText("Task updated: Write RLS and auth tests")).toBeVisible();

  // The project shows up in filtered lists and on the Command Center.
  await page.goto("/projects?status=active");
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: new RegExp(name) }).first()).toBeVisible();

  // Delete the project.
  await page.goto(projectUrl);
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/projects");
  await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
  await page.goto("/activity?entityType=project");
  await expect(page.getByText(`Project deleted: ${name}`)).toBeVisible();
});

test("automation entries are catalogued without running anything", async ({ page }) => {
  const project = uniqueName("Ops");
  const automation = uniqueName("Telegram replies");

  const created = await page.request.post("/api/projects", { data: { name: project } });
  expect(created.status()).toBe(201);

  await page.goto("/automation");
  await expect(page.getByText("No workflow engine is connected")).toBeVisible();
  await page.getByRole("button", { name: "New automation" }).first().click();
  await page.getByLabel("Name").fill(automation);
  await page.getByLabel("What it does").fill("Existing n8n workflow, referenced by id only.");
  await choose(page, "Project", project);

  // A workflow id needs an engine, and URLs are never accepted as ids.
  await page.getByLabel("Workflow id (optional)").fill("wf_telegram_1");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Choose the workflow engine for this workflow id.")).toBeVisible();
  await choose(page, "Workflow engine", "n8n Cloud");
  await page.getByLabel("Workflow id (optional)").fill("https://example.test/webhook");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Use the workflow id only")).toBeVisible();

  await page.getByLabel("Workflow id (optional)").fill("wf_telegram_1");
  await page.getByRole("button", { name: "Save draft" }).click();
  const row = page.getByTestId("automation-row").filter({ hasText: automation });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Not running — no connector yet");
  await expect(row).toContainText("n8n Cloud workflow: wf_telegram_1");
  await expect(row).toContainText(project);

  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "PATCH" && response.ok()),
    choose(page, `Status of ${automation}`, "Ready to link"),
  ]);
  await page.reload();
  await expect(page.getByRole("combobox", { name: `Status of ${automation}` })).toHaveText("Ready to link");

  // Search and status filters narrow the list through the URL.
  await page.getByRole("searchbox", { name: "Search automations" }).fill(automation);
  await page.getByRole("searchbox", { name: "Search automations" }).press("Enter");
  await expect(page).toHaveURL(/\/automation\?q=/);
  await expect(page.getByTestId("automation-row")).toHaveCount(1);
  await page.getByRole("group", { name: "Filter by status" }).getByRole("link", { name: "Paused" }).click();
  await expect(page.getByText("No automations match")).toBeVisible();
  await page.getByRole("group", { name: "Filter by status" }).getByRole("link", { name: "Ready to link" }).click();
  await expect(page.getByTestId("automation-row")).toHaveCount(1);

  await page.getByRole("button", { name: `Actions for ${automation}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("automation-row").filter({ hasText: automation })).toHaveCount(0);
});

test("project lists paginate and global search finds records", async ({ page }) => {
  const prefix = uniqueName("Paged");
  for (let index = 1; index <= 13; index += 1) {
    const response = await page.request.post("/api/projects", { data: { name: `${prefix} ${String(index).padStart(2, "0")}` } });
    expect(response.status()).toBe(201);
  }

  await page.goto(`/projects?q=${encodeURIComponent(prefix)}`);
  await expect(page.getByText("1–12 of 13 projects")).toBeVisible();
  await page.getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("13–13 of 13 projects")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`${prefix} 01`) })).toBeVisible();

  await page.getByRole("searchbox", { name: "Search everything" }).first().fill(`${prefix} 07`);
  await page.getByRole("searchbox", { name: "Search everything" }).first().press("Enter");
  await expect(page).toHaveURL(/\/search\?q=/);
  await page.getByRole("link", { name: new RegExp(`${prefix} 07`) }).click();
  await expect(page.getByRole("heading", { level: 1, name: `${prefix} 07` })).toBeVisible();

  const ids: string[] = [];
  for (const pageNumber of [1, 2]) {
    const response = await page.request.get(`/api/projects?q=${encodeURIComponent(prefix)}&page=${pageNumber}`);
    ids.push(...((await response.json()).data.items as Array<{ id: string }>).map((project) => project.id));
  }
  expect(ids).toHaveLength(13);
  for (const id of ids) expect((await page.request.delete(`/api/projects/${id}`)).status()).toBe(204);
});
