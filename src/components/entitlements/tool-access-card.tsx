import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AccessStatusBadge } from "@/components/entitlements/access-status-badge";
import type { Tool } from "@/config/tools";
import type { ToolAccessState } from "@/lib/entitlements/tool-access";

export type ToolStat = { value: string; unit: string };

/**
 * reference/auth/dashboard.png's tool grid card: a bold title, a quiet
 * subtitle, an optional real stat, and a single circular arrow — no
 * icon tile, no button row. The whole card is one link (same pattern as
 * FeatureCard/PostCard: a Link wrapping a Card, no nested interactive
 * elements), targeting the real in-app tool when it's built and
 * available, its marketing page otherwise — the entitlement-gating
 * logic itself is unchanged from before this restyle, just no longer
 * spelled out in a metered-usage list or a separate row of buttons.
 */
export function ToolAccessCard({
  tool,
  access,
  stat,
}: {
  tool: Tool;
  access: ToolAccessState;
  stat?: ToolStat;
}) {
  const isBuilt = Boolean(tool.appHref);
  const isOpenable = isBuilt && access.status === "available";
  const href = isOpenable ? tool.appHref! : tool.href;

  return (
    <Link href={href} className="block min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Card variant="tool" className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="font-heading text-2xl font-bold text-primary sm:text-3xl">{tool.title}</p>
          <p className="mt-1 truncate text-base text-muted-foreground">{tool.shortDescription}</p>
          {!isBuilt && (
            <span className="mt-2 inline-block text-xs text-muted-foreground">Not built yet</span>
          )}
          {isBuilt && access.status !== "available" && (
            <span className="mt-2 inline-block">
              <AccessStatusBadge status={access.status} />
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4">
          {stat && (
            <p className="text-right leading-tight whitespace-nowrap">
              <span className="text-3xl font-bold text-primary sm:text-4xl">{stat.value}</span>{" "}
              <span className="text-sm text-muted-foreground">{stat.unit}</span>
            </p>
          )}
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 group-hover/card:translate-x-1 group-hover/card:scale-105">
            <ArrowRightIcon className="size-5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
