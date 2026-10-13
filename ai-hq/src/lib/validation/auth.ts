import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email({ message: "Enter a valid email address." })),
  password: z.string().min(1, { message: "Enter your password." }).max(256),
  next: z.string().max(512).optional(),
});

/** Six-digit code from an authenticator app (TOTP). */
export const totpCodeSchema = z
  .string({ message: "Enter the 6-digit code from your authenticator app." })
  .trim()
  .regex(/^\d{6}$/, { message: "Enter the 6-digit code from your authenticator app." });

export const mfaEnrollmentConfirmSchema = z.strictObject({
  factorId: z.uuid({ message: "Start the setup again." }),
  code: totpCodeSchema,
});
