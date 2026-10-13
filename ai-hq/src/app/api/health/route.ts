import { connection, NextResponse } from "next/server";
import { getServerEnvStatus } from "@/lib/env";

/** Public liveness probe. Reports only whether configuration is valid, never its values. */
export async function GET() {
  await connection();
  const config = getServerEnvStatus();
  return NextResponse.json(
    { status: config.ok ? "ok" : "degraded", checks: { configuration: config.ok ? "ok" : "invalid" } },
    { status: config.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
