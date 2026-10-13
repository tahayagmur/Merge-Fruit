"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import { type MfaSignInState, verifyMfaSignIn } from "@/app/actions/mfa";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MfaForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<MfaSignInState, FormData>(verifyMfaSignIn, {});

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {state.error && (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid gap-2">
        <Label htmlFor="mfa-code">Authentication code</Label>
        <Input
          id="mfa-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          className="font-mono tracking-[0.4em]"
          aria-invalid={Boolean(state.error)}
          autoFocus
          required
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        {pending ? "Verifying…" : "Verify"}
      </Button>
    </form>
  );
}
