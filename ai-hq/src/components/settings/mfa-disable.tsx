"use client";

import { Loader2, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { disableMfa } from "@/app/actions/mfa";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Turning two-factor sign-in off needs a current code, not just an open session. */
export function MfaDisable() {
  const router = useRouter();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const result = await disableMfa({ code });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Two-factor sign-in is off");
    setOpen(false);
    setCode("");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setCode("");
          setError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive">
          <ShieldOff /> Turn off
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Turn off two-factor sign-in?</DialogTitle>
          <DialogDescription>
            Your account will be protected by the password only. Enter a current code from your authenticator app to confirm.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField id={`${uid}-mfa-disable-code`} label="Authentication code" error={error}>
            <Input
              id={`${uid}-mfa-disable-code`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="font-mono tracking-[0.4em]"
              aria-invalid={Boolean(error)}
              autoFocus
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Turn off
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
