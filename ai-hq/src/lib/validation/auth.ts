import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email({ message: "Enter a valid email address." })),
  password: z.string().min(1, { message: "Enter your password." }).max(256),
  next: z.string().max(512).optional(),
});
