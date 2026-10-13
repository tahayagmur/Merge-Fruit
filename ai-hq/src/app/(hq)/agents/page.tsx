import type { Metadata } from "next";
import { ModuleRoadmap } from "@/components/roadmap/module-roadmap";
import { MODULE_PLANS } from "@/lib/roadmap";

export const metadata: Metadata = { title: "AI Agent Hub" };

export default function AgentsPage() {
  return <ModuleRoadmap plan={MODULE_PLANS.agents} />;
}
