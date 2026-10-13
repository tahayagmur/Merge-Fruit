import { apiRoute, jsonData, parseWith, readJson } from "@/lib/api/route";
import { assertWorkspaceAdmin } from "@/lib/auth/workspace";
import { getIntegrationView, resetIntegrationConfig, saveIntegrationConfig } from "@/lib/data/integrations";
import { integrationKeySchema, integrationUpdateSchema } from "@/lib/validation/integrations";

type Params = { key: string };

export const GET = apiRoute<Params>(async ({ params, supabase }) => {
  const key = parseWith(integrationKeySchema, params.key);
  return jsonData(await getIntegrationView(supabase, key));
});

/** Saves non-secret settings. Admins only; RLS enforces the same rule in the database. */
export const PATCH = apiRoute<Params>(async ({ request, params, supabase, user }) => {
  const key = parseWith(integrationKeySchema, params.key);
  await assertWorkspaceAdmin(supabase, user.id);
  const input = await readJson(request, integrationUpdateSchema);
  return jsonData(await saveIntegrationConfig(supabase, key, input));
});

/** Clears the saved settings for an integration. Admins only. */
export const DELETE = apiRoute<Params>(async ({ params, supabase, user }) => {
  const key = parseWith(integrationKeySchema, params.key);
  await assertWorkspaceAdmin(supabase, user.id);
  return jsonData(await resetIntegrationConfig(supabase, key));
});
