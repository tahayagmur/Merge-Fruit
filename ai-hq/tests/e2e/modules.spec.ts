import { expect, test } from "@playwright/test";
import { USERS } from "./support/fixtures";
import { choose, signIn, uniqueName } from "./support/helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, USERS.alice);
});

test("Game Studio shows game projects, the release checklist and honest store status", async ({ page }) => {
  const name = uniqueName("Merge Fruit 2");
  const created = await page.request.post("/api/projects", { data: { name, category: "game", status: "active" } });
  expect(created.status()).toBe(201);
  const { data: project } = await created.json();

  await page.goto("/game-studio");
  const active = page.getByRole("region", { name: "Active" });
  await expect(active.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByText("Game release checklist")).toBeVisible();
  await expect(page.getByRole("link", { name: /Google Play Console/ })).toContainText("Not configured");
  await expect(page.getByRole("link", { name: /App Store Connect/ })).toContainText("Not configured");
  await expect(page.getByText("Planned next")).toBeVisible();

  // The checklist copies tasks into the project, once.
  await active.getByRole("link", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: "Add release checklist" }).click();
  await expect(page.getByText("Added 8 tasks")).toBeVisible();
  await expect(page.getByTestId("task-card").filter({ hasText: "Freeze release build and tag the version" })).toBeVisible();
  await page.getByRole("button", { name: "Add release checklist" }).click();
  await expect(page.getByText("Checklist already applied")).toBeVisible();

  expect((await page.request.delete(`/api/projects/${project.id}`)).status()).toBe(204);
});

test("SaaS & Business never shows revenue without a connected source", async ({ page }) => {
  await page.goto("/saas");
  await expect(page.getByText("No revenue data source connected")).toBeVisible();
  await expect(page.getByText("Nothing here is estimated or sample data.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "View Stripe integration" }).click();
  await expect(page).toHaveURL("/integrations/stripe");
  await expect(page.getByRole("heading", { level: 1, name: "Stripe" })).toBeVisible();
});

test("agents are defined, versioned and receive queued tasks that never run", async ({ page }) => {
  const name = uniqueName("Release notes writer");

  await page.goto("/agents");
  await expect(page.getByText("No agent runtime is connected")).toBeVisible();
  await page.getByRole("button", { name: "New agent" }).first().click();
  await page.getByRole("button", { name: "Create agent" }).click();
  await expect(page.getByText("Name is required.")).toBeVisible();

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Purpose").fill("Drafts store release notes");
  await page.getByLabel("Instructions").fill("Write concise release notes from the changelog.");
  await choose(page, "Runtime / provider", "Hermes Agent");
  await page.getByLabel("Write").check();
  await page.getByLabel("Summarize").check();
  await page.getByRole("button", { name: "Create agent" }).click();

  await expect(page).toHaveURL(/\/agents\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("version 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Queue task" })).toBeDisabled();
  const agentUrl = page.url();

  // Making it Ready and changing the instructions bumps the version.
  await page.getByRole("button", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit agent" });
  await choose(page, "Status", "Ready");
  await editDialog.getByLabel("Instructions").fill("Write concise, friendly release notes from the changelog.");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("version 2", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Queue task" }).click();
  const taskDialog = page.getByRole("dialog", { name: "Queue a task" });
  await taskDialog.getByLabel("Title").fill("Notes for 1.4.0");
  await taskDialog.getByLabel("Input").fill("Changelog: new levels, bug fixes.");
  await taskDialog.getByRole("button", { name: "Queue task" }).click();
  await expect(page.getByRole("row", { name: /Notes for 1\.4\.0/ })).toContainText("Queued");
  await expect(page.getByRole("row", { name: /Notes for 1\.4\.0/ })).toContainText("v2");

  // It shows up in the Command Center queue, then gets cancelled.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Notes for 1\.4\.0/ })).toBeVisible();
  await page.goto(agentUrl);
  await page.getByRole("button", { name: "Cancel Notes for 1.4.0" }).click();
  await expect(page.getByRole("row", { name: /Notes for 1\.4\.0/ })).toContainText("Cancelled");

  // List search and filters.
  await page.goto(`/agents?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await page.goto(`/agents?status=disabled&q=${encodeURIComponent(name)}`);
  await expect(page.getByText("No agents match")).toBeVisible();

  await page.goto(agentUrl);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/agents");
  await page.goto("/activity?entityType=agent");
  await expect(page.getByText(name).first()).toBeVisible();
});

test("integrations store non-secret settings and are never shown as connected", async ({ page }) => {
  await page.goto("/integrations");
  await expect(page.getByText("Nothing is connected in this phase")).toBeVisible();
  await expect(page.getByText("Connected · 0")).toBeVisible();
  await page.getByRole("link", { name: /n8n Cloud/ }).click();

  await expect(page).toHaveURL("/integrations/n8n");
  await expect(page.getByText("Connection test unavailable")).toBeVisible();
  await expect(page.getByRole("row", { name: /N8N_API_KEY/ })).toContainText("Missing");
  await expect(page.getByRole("button", { name: /test/i })).toHaveCount(0);

  await page.getByLabel("Instance URL").fill("http://insecure.example");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Use an https:// URL.")).toBeVisible();

  await page.getByLabel("Instance URL").fill("https://studio.app.n8n.cloud");
  await page.getByLabel("Enabled").click();
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "PATCH" && response.ok()),
    page.getByRole("button", { name: "Save settings" }).click(),
  ]);
  await page.reload();
  await expect(page.getByLabel("Instance URL")).toHaveValue("https://studio.app.n8n.cloud");
  // The API key is not in the server environment, so it stays "Not configured".
  await expect(page.getByText("Missing server secrets: n8n API key (N8N_API_KEY)")).toBeVisible();
  await expect(page.getByText("Not configured").first()).toBeVisible();
  await expect(page.getByText(/^Connected$/)).toHaveCount(0);

  // Resetting needs the typed confirmation.
  await page.getByRole("button", { name: "Clear settings" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Clear settings" })).toBeDisabled();
  await dialog.getByLabel(/Type n8n to confirm/).fill("n8n");
  await dialog.getByRole("button", { name: "Clear settings" }).click();
  await expect(page.getByLabel("Instance URL")).toHaveValue("");
  await page.goto("/activity?entityType=integration");
  await expect(page.getByText(/n8n/).first()).toBeVisible();
});
