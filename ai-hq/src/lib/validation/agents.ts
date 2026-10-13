import { z } from "zod";
import { AGENT_CAPABILITIES, AGENT_STATUSES } from "@/lib/domain";
import { integrationsByCategory } from "@/lib/integrations/registry";
import {
  idSchema,
  optionalText,
  pageSchema,
  requireAtLeastOneField,
  requiredText,
  searchQuerySchema,
} from "./common";

const MODEL_PROVIDERS = integrationsByCategory("ai").map((definition) => definition.key) as [string, ...string[]];

const optionalProvider = z
  .union([z.enum(MODEL_PROVIDERS), z.literal("")])
  .nullish()
  .transform((value) => (value ? value : null));

const capabilities = z
  .array(z.enum(AGENT_CAPABILITIES))
  .max(AGENT_CAPABILITIES.length)
  .transform((values) => [...new Set(values)]);

const agentFields = {
  name: requiredText("Name", 80),
  description: optionalText(1000),
  instructions: z.string().trim().max(20_000, { message: "Instructions must be at most 20000 characters." }),
  provider: optionalProvider,
  model: optionalText(100),
  capabilities,
  status: z.enum(AGENT_STATUSES),
};

export const agentCreateSchema = z.strictObject({
  name: agentFields.name,
  description: agentFields.description.optional().default(null),
  instructions: agentFields.instructions.default(""),
  provider: agentFields.provider.optional().default(null),
  model: agentFields.model.optional().default(null),
  capabilities: agentFields.capabilities.default([]),
  status: agentFields.status.default("draft"),
});

export const agentUpdateSchema = z
  .strictObject({
    name: agentFields.name.optional(),
    description: agentFields.description.optional(),
    instructions: agentFields.instructions.optional(),
    provider: agentFields.provider.optional(),
    model: agentFields.model.optional(),
    capabilities: agentFields.capabilities.optional(),
    status: agentFields.status.optional(),
  })
  .refine(requireAtLeastOneField, { message: "Provide at least one field to update." });

export const agentListQuerySchema = z.strictObject({
  status: z.enum(AGENT_STATUSES).optional(),
  q: searchQuerySchema,
  page: pageSchema,
});

const optionalProjectId = z
  .union([idSchema, z.literal("")])
  .nullish()
  .transform((value) => (value ? value : null));

export const agentTaskCreateSchema = z.strictObject({
  title: requiredText("Title", 200),
  input: z.string().trim().max(20_000).default(""),
  projectId: optionalProjectId.optional().default(null),
});

/** Users may edit queued tasks or cancel them. Results are written by the runtime only. */
export const agentTaskUpdateSchema = z
  .strictObject({
    title: requiredText("Title", 200).optional(),
    input: z.string().trim().max(20_000).optional(),
    status: z.literal("cancelled").optional(),
  })
  .refine(requireAtLeastOneField, { message: "Provide at least one field to update." });

export type AgentCreateInput = z.output<typeof agentCreateSchema>;
export type AgentUpdateInput = z.output<typeof agentUpdateSchema>;
export type AgentListQuery = z.output<typeof agentListQuerySchema>;
export type AgentTaskCreateInput = z.output<typeof agentTaskCreateSchema>;
export type AgentTaskUpdateInput = z.output<typeof agentTaskUpdateSchema>;
