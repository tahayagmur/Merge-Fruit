import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { IntegrationStatusBadge } from "@/components/common/status-badges";
import type { IntegrationView } from "@/lib/integrations/types";

/** Compact list of integrations with their real configuration status. */
export function IntegrationStatusList({ integrations }: { integrations: IntegrationView[] }) {
  return (
    <ul className="divide-y divide-border">
      {integrations.map((integration) => (
        <li key={integration.key}>
          <Link
            href={`/integrations/${integration.key}`}
            className="group -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/30"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium group-hover:text-primary">{integration.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {integration.connectorAvailable ? "Connector available" : `Connector planned for Phase ${integration.plannedPhase}`}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              <IntegrationStatusBadge status={integration.status} />
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
