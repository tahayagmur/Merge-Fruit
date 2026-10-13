import { Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="grid size-12 place-items-center rounded-xl border bg-muted">
          <Compass className="size-5 text-muted-foreground" />
        </span>
        <div className="space-y-1">
          <p className="hq-label">404</p>
          <h1 className="text-lg font-semibold">Nothing here</h1>
          <p className="text-sm text-muted-foreground">The page does not exist or you do not have access to it.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Back to Command Center</Link>
        </Button>
      </div>
    </main>
  );
}
