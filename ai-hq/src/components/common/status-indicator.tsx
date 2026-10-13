import { cn } from "@/lib/utils";

/**
 * One visual language for every state in the app. Map domain states to a tone
 * instead of picking colours per screen.
 */
export type Tone = "neutral" | "info" | "accent" | "success" | "warning" | "danger";

const DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  accent: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

const TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  info: "text-info",
  accent: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

const BOX: Record<Tone, string> = {
  neutral: "border-border bg-muted/60",
  info: "border-info/25 bg-info/10",
  accent: "border-primary/25 bg-primary/10",
  success: "border-success/25 bg-success/10",
  warning: "border-warning/25 bg-warning/10",
  danger: "border-destructive/30 bg-destructive/10",
};

export function StatusIndicator({
  tone,
  label,
  variant = "pill",
  className,
}: {
  tone: Tone;
  label: string;
  variant?: "pill" | "dot";
  className?: string;
}) {
  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
        <span className={cn("size-2 shrink-0 rounded-full", DOT[tone])} aria-hidden />
        <span className={TEXT[tone]}>{label}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        BOX[tone],
        TEXT[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden />
      {label}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      title="Demo data — not part of your real records"
      className={cn(
        "inline-flex w-fit items-center rounded-md border border-dashed border-warning/50 px-1.5 py-px font-mono text-[0.6rem] font-semibold tracking-wider text-warning uppercase",
        className,
      )}
    >
      Demo
    </span>
  );
}
