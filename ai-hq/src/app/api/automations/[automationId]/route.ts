import { apiRoute, jsonData, noContent, parseWith, readJson } from "@/lib/api/route";
import { deleteAutomation, updateAutomation } from "@/lib/data/automations";
import { automationUpdateSchema } from "@/lib/validation/automations";
import { idSchema } from "@/lib/validation/common";

type Params = { automationId: string };

export const PATCH = apiRoute<Params>(async ({ request, params, supabase }) => {
  const id = parseWith(idSchema, params.automationId, "Invalid automation id.");
  const input = await readJson(request, automationUpdateSchema);
  return jsonData(await updateAutomation(supabase, id, input));
});

export const DELETE = apiRoute<Params>(async ({ params, supabase }) => {
  const id = parseWith(idSchema, params.automationId, "Invalid automation id.");
  await deleteAutomation(supabase, id);
  return noContent();
});
