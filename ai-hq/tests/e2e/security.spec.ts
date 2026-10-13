import { expect, test } from "@playwright/test";
import { USERS } from "./support/fixtures";
import { signIn, uniqueName } from "./support/helpers";

test("users cannot see or change each other's data", async ({ browser }) => {
  const alice = await browser.newPage();
  await signIn(alice, USERS.alice);
  const name = uniqueName("Alice private");
  const created = await alice.request.post("/api/projects", { data: { name } });
  expect(created.status()).toBe(201);
  const { data: project } = await created.json();
  const task = await alice.request.post(`/api/projects/${project.id}/tasks`, { data: { title: "Secret task" } });
  expect(task.status()).toBe(201);
  const { data: taskData } = await task.json();

  const bob = await browser.newPage();
  await signIn(bob, USERS.bob);

  const list = await bob.request.get("/api/projects");
  expect(list.status()).toBe(200);
  const { data: bobProjects } = await list.json();
  expect(bobProjects.items.map((item: { id: string }) => item.id)).not.toContain(project.id);

  expect((await bob.request.get(`/api/projects/${project.id}`)).status()).toBe(404);
  expect((await bob.request.patch(`/api/projects/${project.id}`, { data: { name: "pwned" } })).status()).toBe(404);
  expect((await bob.request.delete(`/api/projects/${project.id}`)).status()).toBe(404);
  expect((await bob.request.post(`/api/projects/${project.id}/tasks`, { data: { title: "x" } })).status()).toBe(404);
  expect((await bob.request.patch(`/api/tasks/${taskData.id}`, { data: { status: "done" } })).status()).toBe(404);

  const activity = await (await bob.request.get("/api/activity")).json();
  expect(JSON.stringify(activity)).not.toContain(name);

  await bob.goto(`/projects/${project.id}`);
  await expect(bob.getByRole("heading", { name: "Nothing here" })).toBeVisible();

  // Alice's data is untouched.
  const check = await alice.request.get(`/api/projects/${project.id}`);
  expect((await check.json()).data.name).toBe(name);

  expect((await alice.request.delete(`/api/projects/${project.id}`)).status()).toBe(204);
});

test("state-changing requests are protected against cross-site use", async ({ page }) => {
  await signIn(page, USERS.alice);

  const crossOrigin = await page.request.post("/api/projects", {
    headers: { origin: "https://evil.example" },
    data: { name: "csrf" },
  });
  expect(crossOrigin.status()).toBe(403);

  const formPost = await page.request.post("/api/projects", {
    headers: { "content-type": "text/plain" },
    data: JSON.stringify({ name: "csrf" }),
  });
  expect(formPost.status()).toBe(415);

  const spoofedOwner = await page.request.post("/api/projects", {
    data: { name: "spoof", owner_id: USERS.bob.id },
  });
  expect(spoofedOwner.status()).toBe(400);
});

test("members cannot use admin or owner operations, even by calling the API directly", async ({ browser }) => {
  const bob = await browser.newPage();
  await signIn(bob, USERS.bob);

  expect((await bob.request.get("/api/users")).status()).toBe(403);
  expect((await bob.request.patch("/api/settings", { data: { workspaceName: "Taken over" } })).status()).toBe(403);
  expect(
    (await bob.request.patch("/api/integrations/n8n", { data: { settings: { baseUrl: "https://evil.example" } } })).status(),
  ).toBe(403);
  expect((await bob.request.delete("/api/integrations/n8n")).status()).toBe(403);
  expect((await bob.request.patch(`/api/users/${USERS.bob.id}/role`, { data: { role: "owner" } })).status()).toBe(403);

  // The same screens are read-only for members.
  await bob.goto("/settings?tab=workspace");
  await expect(bob.getByText("Only workspace owners and admins can change these settings.")).toBeVisible();
  await expect(bob.getByRole("button", { name: "Save workspace" })).toHaveCount(0);
  await bob.goto("/settings?tab=users");
  await expect(bob.getByText("Only workspace owners and admins can see the user list.")).toBeVisible();
  await bob.goto("/integrations/n8n");
  await expect(bob.getByText("Only workspace owners and admins can change integration settings.")).toBeVisible();
  await expect(bob.getByRole("button", { name: "Save settings" })).toHaveCount(0);
});

test("integration settings reject secrets and unknown keys; agents enforce their rules", async ({ browser }) => {
  const alice = await browser.newPage();
  await signIn(alice, USERS.alice);

  const secret = await alice.request.patch("/api/integrations/n8n", {
    data: { settings: { baseUrl: "https://studio.app.n8n.cloud", apiKey: "n8n_api_should_never_be_stored" } },
  });
  expect(secret.status()).toBe(400);
  expect(JSON.stringify(await secret.json())).not.toContain("n8n_api_should_never_be_stored");
  expect((await alice.request.patch("/api/integrations/not-a-service", { data: { enabled: true } })).status()).toBe(404);

  const agent = await alice.request.post("/api/agents", { data: { name: uniqueName("Draft agent") } });
  expect(agent.status()).toBe(201);
  const { data: agentData } = await agent.json();
  const queued = await alice.request.post(`/api/agents/${agentData.id}/tasks`, { data: { title: "Too early" } });
  expect(queued.status()).toBe(422);
  expect((await queued.json()).error.message).toBe("The agent must be Ready to accept tasks.");

  // Another user cannot see or use the agent.
  const bob = await browser.newPage();
  await signIn(bob, USERS.bob);
  expect((await bob.request.get(`/api/agents/${agentData.id}`)).status()).toBe(404);
  expect((await bob.request.post(`/api/agents/${agentData.id}/tasks`, { data: { title: "x" } })).status()).toBe(404);
  expect((await bob.request.delete(`/api/agents/${agentData.id}`)).status()).toBe(404);

  expect((await alice.request.delete(`/api/agents/${agentData.id}`)).status()).toBe(204);
});
