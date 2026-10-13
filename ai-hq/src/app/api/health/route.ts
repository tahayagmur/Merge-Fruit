import { connection, NextResponse } from "next/server";
import { getServerEnvStatus } from "@/lib/env";

/**
 * Liveness probe (public). Answers 200 while the process is up, so container
 * orchestration does not restart the app for problems a restart cannot fix.
 * It only reports whether configuration is valid, never its values.
 * Use /api/health/ready to decide whether the instance can serve traffic.
 */
export async function GET() {
  await connection();
  const config = getServerEnvStatus();
  return NextResponse.json(
    { status: "ok", checks: { configuration: config.ok ? "ok" : "invalid" } },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
