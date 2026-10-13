import { z } from "zod";
import { WORKSPACE_ROLES } from "@/lib/domain";
import { requireAtLeastOneField, requiredText } from "./common";

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const systemSettingsUpdateSchema = z
  .strictObject({
    workspaceName: requiredText("Workspace name", 60).optional(),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine(isValidTimeZone, { message: "Choose a valid IANA time zone, e.g. Europe/Istanbul." })
      .optional(),
  })
  .refine(requireAtLeastOneField, { message: "Provide at least one field to update." });

export const profileUpdateSchema = z.strictObject({
  displayName: z
    .string()
    .trim()
    .max(80, { message: "Display name must be at most 80 characters." })
    .transform((value) => (value ? value : null)),
});

export const roleUpdateSchema = z.strictObject({
  role: z.enum(WORKSPACE_ROLES),
});

/** Mirrors supabase/config.toml: at least 12 characters with lower case, upper case and digits. */
export const newPasswordSchema = z
  .string()
  .min(12, { message: "Use at least 12 characters." })
  .max(128)
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value), {
    message: "Use upper and lower case letters and at least one digit.",
  });

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Enter your current password." }).max(256),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "The passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "Choose a password different from the current one.",
    path: ["newPassword"],
  });

export type SystemSettingsUpdateInput = z.output<typeof systemSettingsUpdateSchema>;
