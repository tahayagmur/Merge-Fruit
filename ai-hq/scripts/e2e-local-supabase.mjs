// Runs the Playwright suite against the real local Supabase started with `npm run db:start`.
// Reads the local URL and keys from `supabase status` so nothing has to be copied by hand.
import { execFileSync, spawnSync } from "node:child_process";

const status = execFileSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8" });
const values = Object.fromEntries(
  status
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);

if (!values.API_URL || !values.PUBLISHABLE_KEY || !values.SECRET_KEY) {
  console.error("Local Supabase is not running. Start it with `npm run db:start`.");
  process.exit(1);
}

const result = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    E2E_TARGET: "supabase",
    E2E_SUPABASE_URL: values.API_URL,
    E2E_SUPABASE_PUBLISHABLE_KEY: values.PUBLISHABLE_KEY,
    E2E_SUPABASE_SECRET_KEY: values.SECRET_KEY,
  },
});
process.exit(result.status ?? 1);
