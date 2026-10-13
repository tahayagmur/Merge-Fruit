"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { changePassword, type PasswordChangeState } from "@/app/actions/account";
import { FormField } from "@/components/common/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const INITIAL: PasswordChangeState = {};

export function PasswordForm() {
  const uid = useId();
  const [state, action, pending] = useActionState(changePassword, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Password changed. Other sessions were signed out.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:max-w-md" noValidate>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>
            <p>{state.error}</p>
          </AlertDescription>
        </Alert>
      )}
      <FormField id={`${uid}-current-password`} label="Current password" error={state.fieldErrors?.currentPassword}>
        <Input
          id={`${uid}-current-password`}
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.currentPassword)}
        />
      </FormField>
      <FormField
        id={`${uid}-new-password`}
        label="New password"
        error={state.fieldErrors?.newPassword}
        hint="At least 12 characters with upper and lower case letters and a digit."
      >
        <Input
          id={`${uid}-new-password`}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.newPassword)}
        />
      </FormField>
      <FormField id={`${uid}-confirm-password`} label="Confirm new password" error={state.fieldErrors?.confirmPassword}>
        <Input
          id={`${uid}-confirm-password`}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
        />
      </FormField>
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Change password
        </Button>
      </div>
    </form>
  );
}
