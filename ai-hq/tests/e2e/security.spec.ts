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
  expect(bobProjects.map((item: { id: string }) => item.id)).not.toContain(project.id);

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
