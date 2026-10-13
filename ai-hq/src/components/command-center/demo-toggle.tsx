import Link from "next/link";
import { cn } from "@/lib/utils";

/** URL-driven toggle: figures exclude demo data unless ?demo=include is set. */
export function DemoToggle({ included, demoRecords }: { included: boolean; demoRecords: number }) {
  if (demoRecords === 0) return null;
  return (
    <Link
      href={included ? "/" : "/?demo=include"}
      role="switch"
      aria-checked={included}
      className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-warning/40 hover:text-foreground"
    >
      <span
        className={cn(
          "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
          included ? "bg-warning" : "bg-input",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute size-3 rounded-full bg-background transition-transform",
            included ? "translate-x-3.5" : "translate-x-0.5",
          )}
        />
      </span>
      Include demo data ({demoRecords})
    </Link>
  );
}
