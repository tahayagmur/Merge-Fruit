"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OptionSelectProps<T extends string> {
  id: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
  "aria-label"?: string;
}

/** Typed shadcn Select for enum-like values. */
export function OptionSelect<T extends string>({
  id,
  value,
  options,
  labels,
  onChange,
  disabled,
  size,
  className,
  ...aria
}: OptionSelectProps<T>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)} disabled={disabled}>
      <SelectTrigger id={id} size={size} className={className ?? "w-full"} aria-label={aria["aria-label"]}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {labels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
