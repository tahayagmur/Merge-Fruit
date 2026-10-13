"use client";

import { Loader2, QrCode, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { confirmMfaEnrollment, type MfaEnrollment, startMfaEnrollment } from "@/app/actions/mfa";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Adds an authenticator app: QR code (or key) → first code → two-factor sign-in on. */
export function MfaSetup() {
  const router = useRouter();
  const uid = useId();
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    setError(undefined);
    const result = await startMfaEnrollment();
    setPending(false);
    if (result.ok) setEnrollment(result.data);
    else toast.error(result.error);
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;
    setPending(true);
    setError(undefined);
    const result = await confirmMfaEnrollment({ factorId: enrollment.factorId, code });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Two-factor sign-in is on");
    setEnrollment(null);
    setCode("");
    router.refresh();
  }

  if (!enrollment) {
    return (
      <div>
        <Button onClick={start} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <QrCode />}
          Set up authenticator app
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="grid gap-5 sm:max-w-md" noValidate>
      <ol className="grid gap-4 text-sm">
        <li className="grid gap-3">
          <span>1. Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy…).</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- one-off data: URL, nothing to optimise */}
          <img
            src={enrollment.qrCode}
            alt="QR code for your authenticator app"
            width={176}
            height={176}
            className="rounded-lg bg-white p-2"
          />
          <span className="grid gap-1">
            <span className="text-xs text-muted-foreground">Or enter this key manually:</span>
            <code data-testid="mfa-secret" className="font-mono text-sm break-all select-all">
              {enrollment.secret}
            </code>
          </span>
        </li>
        <li>2. Enter the 6-digit code the app shows.</li>
      </ol>
      <FormField id={`${uid}-mfa-code`} label="Authentication code" error={error}>
        <Input
          id={`${uid}-mfa-code`}
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          Verify and turn on
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEnrollment(null)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
