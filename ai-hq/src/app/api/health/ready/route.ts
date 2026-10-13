import { connection, NextResponse } from "next/server";
import { getServerEnvStatus } from "@/lib/env";
import { logger } from "@/lib/logger";

const TIMEOUT_MS = 2_500;

/**
 * Readiness probe (public). Ready means: configuration is valid and the
 * configured Supabase Auth service answers its health check. It reports
 * check names and outcomes only — no URLs, versions or error details.
 */
export async function GET() {
  await connection();
  const config = getServerEnvStatus();
  const checks: Record<string, "ok" | "invalid" | "unreachable" | "skipped"> = {
    configuration: config.ok ? "ok" : "invalid",
    auth: "skipped",
  };

  if (config.ok) {
    try {
      const response = await fetch(new URL("/auth/v1/health", config.env.supabaseUrl), {
        headers: { apikey: config.env.supabasePublishableKey },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      checks.auth = response.ok ? "ok" : "unreachable";
    } catch (error) {
      logger.warn("health.auth_unreachable", { error });
      checks.auth = "unreachable";
    }
  }

  const ready = Object.values(checks).every((value) => value === "ok");
  return NextResponse.json(
    { status: ready ? "ready" : "not_ready", checks },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
