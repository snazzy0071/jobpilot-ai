import { Lock, CircleCheck, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AccessStatus } from "@/lib/entitlements/tool-access";

const STATUS_CONFIG: Record<AccessStatus, { label: string; variant: "secondary" | "outline" | "destructive"; icon: typeof Lock }> = {
  available: { label: "Available", variant: "secondary", icon: CircleCheck },
  "limit-reached": { label: "Limit reached", variant: "destructive", icon: CircleAlert },
  locked: { label: "Upgrade to unlock", variant: "outline", icon: Lock },
};

/** The one place that decides how each of the three access states looks — reused anywhere a tool's status needs to render. */
export function AccessStatusBadge({ status }: { status: AccessStatus }) {
  const { label, variant, icon: Icon } = STATUS_CONFIG[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
