import { z } from "zod";
import { AUTOMATION_STATUSES, AUTOMATION_TRIGGERS } from "@/lib/domain";
import { integrationsByCategory } from "@/lib/integrations/registry";
import { idSchema, optionalText, pageSchema, requireAtLeastOneField, requiredText, searchQuerySchema } from "./common";

/** A workflow *identifier* only. URLs, webhook paths and keys are rejected on purpose. */
export const externalWorkflowIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, {
    message: "Use the workflow id only (letters, digits, - and _). Never paste URLs or keys.",
  });

const WORKFLOW_PROVIDERS = integrationsByCategory("automation").map((definition) => definition.key) as [
  string,
  ...string[],
];

const optionalWorkflowId = z
  .union([externalWorkflowIdSchema, z.literal("")])
  .nullish()
  .transform((value) => (value ? value : null));

const optionalProvider = z
  .union([z.enum(WORKFLOW_PROVIDERS), z.literal("")])
  .nullish()
  .transform((value) => (value ? value : null));

const optionalProjectId = z
  .union([idSchema, z.literal("")])
  .nullish()
  .transform((value) => (value ? value : null));

const providerRequired = {
  check: (value: { provider?: string | null; externalWorkflowId?: string | null }) =>
    !value.externalWorkflowId || Boolean(value.provider),
  options: { message: "Choose the workflow engine for this workflow id.", path: ["provider"] },
};

export const automationCreateSchema = z
  .strictObject({
    name: requiredText("Name", 120),
    description: optionalText(2000).optional().default(null),
    projectId: optionalProjectId.optional().default(null),
    triggerType: z.enum(AUTOMATION_TRIGGERS).default("manual"),
    triggerNotes: optionalText(500).optional().default(null),
    provider: optionalProvider.optional().default(null),
    externalWorkflowId: optionalWorkflowId.optional().default(null),
    status: z.enum(AUTOMATION_STATUSES).default("draft"),
  })
  .refine(providerRequired.check, providerRequired.options);

export const automationUpdateSchema = z
  .strictObject({
    name: requiredText("Name", 120).optional(),
    description: optionalText(2000).optional(),
    projectId: optionalProjectId.optional(),
    triggerType: z.enum(AUTOMATION_TRIGGERS).optional(),
    triggerNotes: optionalText(500).optional(),
    provider: optionalProvider.optional(),
    externalWorkflowId: optionalWorkflowId.optional(),
    status: z.enum(AUTOMATION_STATUSES).optional(),
  })
  .refine(requireAtLeastOneField, { message: "Provide at least one field to update." });

export const automationListQuerySchema = z.strictObject({
  status: z.enum(AUTOMATION_STATUSES).optional(),
  q: searchQuerySchema,
  page: pageSchema,
});

export type AutomationCreateInput = z.output<typeof automationCreateSchema>;
export type AutomationUpdateInput = z.output<typeof automationUpdateSchema>;
export type AutomationListQuery = z.output<typeof automationListQuerySchema>;
