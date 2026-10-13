import { z } from "zod";
import { AUTOMATION_STATUSES, AUTOMATION_TRIGGERS } from "@/lib/domain";
import { idSchema, optionalText, requireAtLeastOneField, requiredText } from "./common";

/** An n8n workflow *identifier* only. URLs, webhook paths and keys are rejected on purpose. */
export const n8nWorkflowIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, {
    message: "Use the workflow id only (letters, digits, - and _). Never paste URLs or keys.",
  });

const optionalWorkflowId = z
  .union([n8nWorkflowIdSchema, z.literal("")])
  .nullish()
  .transform((value) => (value ? value : null));

const optionalProjectId = z
  .union([idSchema, z.literal("")])
  .nullish()
  .transform((value) => (value ? value : null));

export const automationCreateSchema = z.strictObject({
  name: requiredText("Name", 120),
  description: optionalText(2000).optional().default(null),
  projectId: optionalProjectId.optional().default(null),
  triggerType: z.enum(AUTOMATION_TRIGGERS).default("manual"),
  triggerNotes: optionalText(500).optional().default(null),
  n8nWorkflowId: optionalWorkflowId.optional().default(null),
  status: z.enum(AUTOMATION_STATUSES).default("draft"),
});

export const automationUpdateSchema = z
  .strictObject({
    name: requiredText("Name", 120).optional(),
    description: optionalText(2000).optional(),
    projectId: optionalProjectId.optional(),
    triggerType: z.enum(AUTOMATION_TRIGGERS).optional(),
    triggerNotes: optionalText(500).optional(),
    n8nWorkflowId: optionalWorkflowId.optional(),
    status: z.enum(AUTOMATION_STATUSES).optional(),
  })
  .refine(requireAtLeastOneField, { message: "Provide at least one field to update." });

export type AutomationCreateInput = z.output<typeof automationCreateSchema>;
export type AutomationUpdateInput = z.output<typeof automationUpdateSchema>;
