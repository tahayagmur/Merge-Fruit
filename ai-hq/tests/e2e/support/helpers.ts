import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Mission overview" })).toBeVisible();
}

/** Picks an option in a shadcn/Radix select identified by its accessible name. */
export async function choose(page: Page, selectName: string | RegExp, option: string) {
  await page.getByRole("combobox", { name: selectName }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

export function uniqueName(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}
