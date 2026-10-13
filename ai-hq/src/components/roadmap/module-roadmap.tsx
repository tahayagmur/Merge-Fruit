import { ArrowRight, CheckCircle2, Circle, CircleDot, Link2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function ModuleRoadmap({ plan, children }: { plan: ModulePlan; children?: ReactNode }) {
  const statusLabel = plan.status === "partial" ? "Partially available" : "Planned";
  return (
    <>
      <PageHeader
        eyebrow={plan.title}
        title={plan.title}
        description={plan.summary}
        actions={
          <Badge variant={plan.status === "partial" ? "accent" : "outline"} className="px-2.5 py-1">
            {statusLabel} · Phase {plan.phase}
          </Badge>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          {children}
          <Card>
            <CardHeader>
              <CardTitle>Available today</CardTitle>
              <CardDescription>What you can already use in this phase.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ul className="grid gap-2">
                {plan.availableToday.map((item) => (
                  <li key={item} className="flex gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
              {plan.todayLink && (
                <Button variant="outline" size="sm" className="w-fit" asChild>
                  <Link href={plan.todayLink.href}>
                    {plan.todayLink.label} <ArrowRight />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Planned scope</CardTitle>
              <CardDescription>Not built yet. Delivered in Phase {plan.phase}.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {plan.planned.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                    <Circle className="mt-0.5 size-4 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Depends on</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {plan.dependsOn.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                    <Link2 className="mt-0.5 size-4 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Development plan</CardTitle>
            <CardDescription>Where this module fits.</CardDescription>
          </CardHeader>
          <CardContent>
            <PhaseTimeline highlight={plan.phase} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
