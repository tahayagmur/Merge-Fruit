import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PhaseTimeline } from "@/components/roadmap/module-roadmap";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NAV_ITEMS } from "@/lib/navigation";
import { MODULE_PLANS } from "@/lib/roadmap";

export const metadata: Metadata = { title: "Development plan" };

const STATUS_LABEL = { live: "Live", partial: "Partial", planned: "Planned" } as const;
const STATUS_VARIANT = { live: "success", partial: "accent", planned: "outline" } as const;

export default function RoadmapPage() {
  return (
    <>
      <PageHeader
        eyebrow="Development plan"
        title="Roadmap"
        description="What is live, what is next, and what each module depends on."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Phases</CardTitle>
          </CardHeader>
          <CardContent>
            <PhaseTimeline />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Modules</CardTitle>
            <CardDescription>Every section in the sidebar and its current state.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {NAV_ITEMS.map((item) => {
                const plan = item.planId ? MODULE_PLANS[item.planId] : undefined;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link href={item.href} className="group flex items-center gap-3 py-3">
                      <Icon className="size-4 text-muted-foreground group-hover:text-primary" />
                      <span className="flex-1 text-sm font-medium group-hover:text-primary">{item.label}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {item.status === "live" ? "Delivered" : `Remaining parts · Phase ${plan?.phase ?? "—"}`}
                      </span>
                      <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
