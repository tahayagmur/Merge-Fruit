"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function HqError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <span className="grid size-12 place-items-center rounded-xl border border-destructive/30 bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">This section could not be loaded</h1>
        <p className="text-sm text-muted-foreground">
          The server could not complete the request. Check the database connection and try again.
          {error.digest && <span className="mt-2 block font-mono text-xs">Reference: {error.digest}</span>}
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
