import { defineConfig, devices } from "@playwright/test";
import { ALLOWED_EMAILS, APP_PORT, APP_URL, EMULATOR_PORT } from "./tests/e2e/support/fixtures";
import { e2eBackend } from "./tests/e2e/support/target";

/**
 * End-to-end tests run the production build against the test-only Supabase
 * emulator (tests/e2e/support), so they need no Docker and no credentials.
 *
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: use a pre-installed Chromium instead of
 * `npx playwright install` (handy in sandboxes and CI images).
 * E2E_SKIP_BUILD=1: reuse an existing `.next` build.
 * E2E_EXTERNAL_APP=1: test an app that is already running on APP_URL (e.g. the
 *   Docker container), instead of starting one.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const backend = e2eBackend();
// Same server as production: the standalone bundle.
const startApp = "npm start";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // The suite shares one in-memory database, so run it serially.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: APP_URL,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: [
    ...(backend.target === "emulator"
      ? [
          {
            command: "npx tsx tests/e2e/support/start-emulator.ts",
            port: EMULATOR_PORT,
            reuseExistingServer: false,
            timeout: 60_000,
          },
        ]
      : []),
    ...(process.env.E2E_EXTERNAL_APP ? [] : [appServer()]),
  ],
});

function appServer() {
  return {
    command: process.env.E2E_SKIP_BUILD ? startApp : `npx next build && ${startApp}`,
    url: `${APP_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      APP_ENV: "development",
      SUPABASE_URL: backend.supabaseUrl,
      SUPABASE_PUBLISHABLE_KEY: backend.publishableKey,
      AI_HQ_ALLOWED_EMAILS: ALLOWED_EMAILS,
      PORT: String(APP_PORT),
      HOSTNAME: "127.0.0.1",
    },
  };
}
