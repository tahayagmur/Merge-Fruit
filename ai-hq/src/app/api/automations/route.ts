import { apiRoute, jsonData, readJson } from "@/lib/api/route";
import { createAutomation, listAutomations } from "@/lib/data/automations";
import { automationCreateSchema } from "@/lib/validation/automations";

export const GET = apiRoute(async ({ supabase }) => jsonData(await listAutomations(supabase)));

export const POST = apiRoute(async ({ request, supabase, user }) => {
  const input = await readJson(request, automationCreateSchema);
  return jsonData(await createAutomation(supabase, user.id, input), 201);
});
