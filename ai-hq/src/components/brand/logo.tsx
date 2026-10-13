import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-8 place-items-center rounded-lg border border-primary/30 bg-primary/10 shadow-[0_0_24px_-6px_var(--primary)]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
        <path d="M12 12 4 7.5M12 12l8-4.5M12 12v9" strokeOpacity=".55" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight">AI HQ</span>
        <span className="hq-label mt-1 text-[0.6rem]">Command center</span>
      </span>
    </span>
  );
}
