"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, apiRequest, errorMessage } from "@/lib/api-client";

export function ProfileForm({ displayName }: { displayName: string | null }) {
  const uid = useId();
  const router = useRouter();
  const [value, setValue] = useState(displayName ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await apiRequest("/api/profile", { method: "PATCH", body: { displayName: value } });
      toast.success("Profile saved");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.fieldErrors().displayName);
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:max-w-md" noValidate>
      <FormField id={`${uid}-profile-display-name`} label="Display name" error={error} hint="Shown in the top bar. Leave empty to use your e-mail.">
        <Input
          id={`${uid}-profile-display-name`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={80}
          autoComplete="name"
          aria-invalid={Boolean(error)}
        />
      </FormField>
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save profile
        </Button>
      </div>
    </form>
  );
}
