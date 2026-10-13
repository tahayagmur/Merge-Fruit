"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, apiRequest, errorMessage } from "@/lib/api-client";

interface WorkspaceFormProps {
  workspaceName: string;
  timezone: string;
  timeZones: string[];
}

export function WorkspaceForm({ workspaceName, timezone, timeZones }: WorkspaceFormProps) {
  const uid = useId();
  const router = useRouter();
  const [name, setName] = useState(workspaceName);
  const [zone, setZone] = useState(timezone);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await apiRequest("/api/settings", { method: "PATCH", body: { workspaceName: name, timezone: zone } });
      toast.success("Workspace settings saved");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) setErrors(error.fieldErrors());
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:max-w-md" noValidate>
      <FormField id={`${uid}-workspace-name`} label="Workspace name" error={errors.workspaceName}>
        <Input
          id={`${uid}-workspace-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          required
          aria-invalid={Boolean(errors.workspaceName)}
        />
      </FormField>
      <FormField
        id={`${uid}-workspace-timezone`}
        label="Time zone"
        error={errors.timezone}
        hint="Used for “today”, due dates and overdue figures. IANA name, e.g. Europe/Istanbul."
      >
        <Input
          id={`${uid}-workspace-timezone`}
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          list={`${uid}-workspace-timezones`}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          required
          aria-invalid={Boolean(errors.timezone)}
        />
        <datalist id={`${uid}-workspace-timezones`}>
          {timeZones.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </FormField>
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save workspace
        </Button>
      </div>
    </form>
  );
}
