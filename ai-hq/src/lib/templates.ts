import type { Priority } from "@/lib/domain";
import type { ProjectTemplate } from "@/lib/validation/projects";

export interface TemplateTask {
  title: string;
  description: string;
  priority: Priority;
}

export interface ProjectTemplateDefinition {
  key: ProjectTemplate;
  name: string;
  description: string;
  tasks: TemplateTask[];
}

/** Built-in task checklists. Applying one only creates tasks inside AI HQ. */
export const PROJECT_TEMPLATES: Record<ProjectTemplate, ProjectTemplateDefinition> = {
  game_release: {
    key: "game_release",
    name: "Game release checklist",
    description: "Store, compliance and launch steps for publishing a mobile or web game.",
    tasks: [
      { title: "Freeze release build and tag the version", description: "", priority: "high" },
      { title: "Run the full playtest pass on target devices", description: "", priority: "high" },
      { title: "Prepare store listing: title, short and full description", description: "", priority: "medium" },
      { title: "Capture screenshots and the feature graphic / trailer", description: "", priority: "medium" },
      { title: "Complete content rating questionnaire", description: "", priority: "medium" },
      { title: "Publish privacy policy and data safety answers", description: "", priority: "high" },
      { title: "Configure ads / in-app purchases and test them", description: "", priority: "medium" },
      { title: "Plan the staged rollout and monitoring", description: "", priority: "medium" },
    ],
  },
  saas_launch: {
    key: "saas_launch",
    name: "SaaS launch checklist",
    description: "Product, billing, legal and support steps before opening a SaaS product.",
    tasks: [
      { title: "Define pricing plans and limits", description: "", priority: "high" },
      { title: "Set up billing in test mode and verify the flow", description: "", priority: "high" },
      { title: "Publish terms of service and privacy policy", description: "", priority: "high" },
      { title: "Configure transactional e-mails", description: "", priority: "medium" },
      { title: "Prepare onboarding and help content", description: "", priority: "medium" },
      { title: "Set up error monitoring and uptime checks", description: "", priority: "medium" },
      { title: "Define KPIs to track after launch", description: "", priority: "low" },
      { title: "Plan the launch announcement", description: "", priority: "low" },
    ],
  },
};
