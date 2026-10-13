import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/route";
import { buildPersonalExport } from "@/lib/data/export";
import { logger } from "@/lib/logger";

/** Downloads everything the signed-in user owns as one JSON file. */
export const GET = apiRoute(async ({ supabase, user }) => {
  const data = await buildPersonalExport(supabase, user);
  const counts = {
    projects: data.projects.length,
    tasks: data.tasks.length,
    automations: data.automations.length,
    agents: data.agents.length,
    agentTasks: data.agentTasks.length,
    activity: data.activity.length,
  };
  logger.info("account.data_exported", { userId: user.id, ...counts });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="ai-hq-export-${data.exportedAt.slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
});
