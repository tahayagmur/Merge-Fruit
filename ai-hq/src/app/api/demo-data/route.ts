import { apiRoute, jsonData } from "@/lib/api/route";
import { getDemoDataStatus, loadDemoData, removeDemoData } from "@/lib/demo/service";
import { getServerEnv } from "@/lib/env";

export const GET = apiRoute(async ({ supabase }) => jsonData(await getDemoDataStatus(supabase)));

/** Loads the labelled demo dataset for the caller (refused in production). */
export const POST = apiRoute(async ({ supabase, user }) =>
  jsonData(await loadDemoData(supabase, user.id, getServerEnv().appEnv), 201),
);

/** Removes the caller's demo records only; real data is never touched. */
export const DELETE = apiRoute(async ({ supabase }) => jsonData(await removeDemoData(supabase)));
