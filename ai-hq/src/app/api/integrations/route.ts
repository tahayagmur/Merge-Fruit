import { apiRoute, jsonData } from "@/lib/api/route";
import { listIntegrationViews } from "@/lib/data/integrations";

/** Every integration with its computed status. Contains no secret values. */
export const GET = apiRoute(async ({ supabase }) => jsonData(await listIntegrationViews(supabase)));
