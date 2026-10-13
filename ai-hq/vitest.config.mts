import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
          setupFiles: ["tests/setup/server-only.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["src/**/*.test.tsx", "tests/unit/**/*.test.tsx"],
          setupFiles: ["tests/setup/server-only.ts", "tests/setup/dom.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          // A shared TEST_DATABASE_URL is reset by every file, so files must run one by one.
          fileParallelism: !process.env.TEST_DATABASE_URL,
          // One database instance per file; PGlite boot + migrations take a moment.
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
