"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiRequest, errorMessage } from "@/lib/api-client";
import { NOT_SET, toFormValue, toSettings } from "@/lib/integrations/form-values";
import type { SettingField } from "@/lib/integrations/types";

interface IntegrationSettingsFormProps {
  integrationKey: string;
  name: string;
  fields: SettingField[];
  settings: Record<string, unknown>;
  enabled: boolean;
  /** True when a configuration row exists and can be reset. */
  saved: boolean;
}

/** Non-secret settings only. Credentials are server environment variables and never pass through this form. */
export function IntegrationSettingsForm({ integrationKey, name, fields, settings, enabled, saved }: IntegrationSettingsFormProps) {
  const router = useRouter();
  const uid = useId();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, toFormValue(field, settings[field.key])])),
  );
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await apiRequest(`/api/integrations/${integrationKey}`, {
        method: "PATCH",
        body: { enabled: isEnabled, settings: toSettings(fields, values) },
      });
      toast.success(`${name} settings saved`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) setErrors(error.fieldErrors());
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function reset() {
    try {
      await apiRequest(`/api/integrations/${integrationKey}`, { method: "DELETE" });
      setValues(Object.fromEntries(fields.map((field) => [field.key, toFormValue(field, undefined)])));
      setIsEnabled(false);
      toast.success(`${name} settings cleared`);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
        <div className="grid gap-1">
          <label htmlFor={`${uid}-enabled`} className="text-sm font-medium">
            Enabled
          </label>
          <p className="text-xs text-muted-foreground">
            Marks the integration as wanted. It still contacts nothing until its connector exists and a connection test passes.
          </p>
        </div>
        <Switch id={`${uid}-enabled`} checked={isEnabled} onCheckedChange={setIsEnabled} />
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">This integration has no settings besides its server secrets.</p>
      ) : (
        fields.map((field) => {
          const id = `${uid}-${field.key}`;
          const label = field.required ? field.label : `${field.label} (optional)`;
          return (
            <FormField key={field.key} id={id} label={label} error={errors[field.key]} hint={field.help}>
              {field.type === "select" ? (
                <Select value={values[field.key]} onValueChange={(value) => setValue(field.key, value)}>
                  <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(errors[field.key])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOT_SET}>Not set</SelectItem>
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "list" ? (
                <Textarea
                  id={id}
                  value={values[field.key]}
                  onChange={(event) => setValue(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  rows={4}
                  spellCheck={false}
                  className="font-mono text-xs"
                  aria-invalid={Boolean(errors[field.key])}
                />
              ) : (
                <Input
                  id={id}
                  type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
                  inputMode={field.type === "number" ? "numeric" : undefined}
                  value={values[field.key]}
                  onChange={(event) => setValue(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  className={field.type === "number" ? undefined : "font-mono"}
                  aria-invalid={Boolean(errors[field.key])}
                />
              )}
            </FormField>
          );
        })
      )}
      {errors.settings && <p className="text-xs text-destructive">{errors.settings}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        {saved ? (
          <ConfirmDelete
            title={`Clear ${name} settings?`}
            description="The saved settings and the enabled flag are removed. Server secrets are not affected."
            confirmLabel="Clear settings"
            confirmPhrase={integrationKey}
            onConfirm={reset}
            trigger={
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                <RotateCcw /> Clear settings
              </Button>
            }
          />
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save settings
        </Button>
      </div>
    </form>
  );
}
