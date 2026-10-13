import type { Metadata } from "next";
import { ModuleRoadmap } from "@/components/roadmap/module-roadmap";
import { MODULE_PLANS } from "@/lib/roadmap";

export const metadata: Metadata = { title: "Game Studio" };

export default function GameStudioPage() {
  return <ModuleRoadmap plan={MODULE_PLANS["game-studio"]} />;
}
