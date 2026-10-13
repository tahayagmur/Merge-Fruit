import type { Metadata } from "next";
import { ModuleRoadmap } from "@/components/roadmap/module-roadmap";
import { MODULE_PLANS } from "@/lib/roadmap";

export const metadata: Metadata = { title: "SaaS & Business" };

export default function SaasPage() {
  return <ModuleRoadmap plan={MODULE_PLANS.saas} />;
}
