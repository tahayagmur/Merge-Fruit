import { CheckCircle2, Circle, CircleDot, Link2 } from "lucide-react";
import Link from "next/link";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ModulePlan, ROADMAP_PHASES } from "@/lib/roadmap";
import { cn } from "@/lib/utils";

export function PhaseTimeline({ highlight }: { highlight?: number }) {
  return (
    <ol className="grid gap-3">
      {ROADMAP_PHASES.map((phase) => {
        const Icon = phase.status === "done" ? CheckCircle2 : phase.status === "next" ? CircleDot : Circle;
        return (
          <li
            key={phase.phase}
            className={cn(
              "flex gap-3 rounded-lg border p-3",
              highlight === phase.phase ? "border-primary/40 bg-primary/5" : "bg-card",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                phase.status === "done" && "text-success",
                phase.status === "next" && "text-primary",
                phase.status === "later" && "text-muted-foreground",
              )}
            />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                Phase {phase.phase} · {phase.title}
                {phase.status === "done" && <span className="ml-2 text-xs text-success">Delivered</span>}
                {phase.status === "next" && <span className="ml-2 text-xs text-primary">Next</span>}
              </p>
              <p className="text-xs text-muted-foreground">{phase.goal}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** "What is not built yet" card for modules whose external parts arrive in later phases. */
export function PlannedScopeCard({ plan }: { plan: ModulePlan }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Planned next</CardTitle>
        <CardDescription>Not built yet. Requires external connections planned for Phase {plan.phase}.</CardDescription>
        <CardAction>
          <Link href="/roadmap" className="text-xs text-primary hover:underline">
            Development plan
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="grid gap-2">
          {plan.planned.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-muted-foreground">
              <Circle className="mt-0.5 size-4 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <div className="grid gap-2 border-t pt-4">
          <p className="hq-label">Depends on</p>
          {plan.dependsOn.map((item) => (
            <p key={item} className="flex gap-2 text-sm text-muted-foreground">
              <Link2 className="mt-0.5 size-4 shrink-0" />
              {item}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
