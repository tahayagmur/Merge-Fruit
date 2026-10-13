"use client";

import { AlertTriangle, Loader2, LogIn } from "lucide-react";
import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/actions/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  next?: string;
  notice?: string;
  configIssues?: string[];
}

export function LoginForm({ next, notice, configIssues }: LoginFormProps) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {});
  const error = state.error ?? notice;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {configIssues && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Setup incomplete</AlertTitle>
          <AlertDescription>
            {configIssues.length > 0 ? (
              <ul className="list-disc pl-4">
                {configIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : (
              <p>The server configuration is incomplete. Contact the administrator.</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {next && <input type="hidden" name="next" value={next} />}

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          required
        />
        {state.fieldErrors?.email && (
          <p id="email-error" className="text-xs text-destructive">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          required
        />
        {state.fieldErrors?.password && (
          <p id="password-error" className="text-xs text-destructive">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" disabled={pending || Boolean(configIssues)}>
        {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
