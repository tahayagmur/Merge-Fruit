"use server";

import { redirect } from "next/navigation";
import { isEmailAllowed, safeRedirectPath } from "@/lib/auth/access";
import { getServerEnvStatus } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validation/auth";

export interface SignInState {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  email?: string;
}

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";

  if (!parsed.success) {
    const fieldErrors: SignInState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "email" || key === "password") && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors, email };
  }

  const config = getServerEnvStatus();
  if (!config.ok) {
    return { error: "AI HQ is not configured yet. Complete the environment setup first.", email };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    if (error?.status === 429) return { error: "Too many attempts. Wait a moment and try again.", email };
    // Same message for unknown email and wrong password: no account enumeration.
    return { error: "Invalid email or password.", email };
  }

  if (!isEmailAllowed(data.user.email, config.env.allowedEmails)) {
    await supabase.auth.signOut();
    return { error: "This account is not allowed to use AI HQ.", email };
  }

  redirect(safeRedirectPath(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const config = getServerEnvStatus();
  if (config.ok) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
