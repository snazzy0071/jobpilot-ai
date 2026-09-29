import { AlertTriangleIcon, CheckCircle2Icon, CircleOffIcon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { hasPermission } from "@/lib/admin/permissions";
import { runAllHealthChecks } from "@/lib/health/checks";
import type { HealthCheckResult, HealthStatus } from "@/lib/health/types";

export const dynamic = "force-dynamic";

const STATUS_META: Record<HealthStatus, { label: string; className: string; icon: typeof CheckCircle2Icon }> = {
  operational: { label: "Operational", className: "border-success/30 bg-success/15 text-success", icon: CheckCircle2Icon },
  degraded: { label: "Degraded", className: "border-warning/30 bg-warning/15 text-warning", icon: AlertTriangleIcon },
  down: { label: "Down", className: "border-destructive/30 bg-destructive/15 text-destructive", icon: XCircleIcon },
  not_configured: { label: "Not configured", className: "border-border text-muted-foreground", icon: CircleOffIcon },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function CheckCard({ check }: { check: HealthCheckResult }) {
  const meta = STATUS_META[check.status];
  const Icon = meta.icon;
  return (
    <Card className="gap-2 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{check.label}</p>
        <Badge variant="outline" className={meta.className}>
          <Icon className="size-3.5" /> {meta.label}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{check.detail}</p>
      <p className="text-xs text-muted-foreground">Checked {formatDateTime(check.checkedAt)}</p>
    </Card>
  );
}

/**
 * The full-detail internal view — every field `runAllHealthChecks()`
 * returns, including `detail` (real diagnostic text: a caught error's
 * message, a per-source sync breakdown). The public `/status` page
 * runs the exact same checks but only ever renders `status`, never
 * this — that's the actual "safe summarized" boundary this task asked
 * for, enforced by which page reads which field, not by two different
 * implementations that could drift apart.
 */
export default async function AdminSystemHealthPage() {
  const { user } = await requireAdmin();
  const [checks, canSeeEmailLogs] = await Promise.all([runAllHealthChecks(), hasPermission(user.id, "view_email_logs")]);

  return (
    <div className="flex flex-col gap-6">
      {canSeeEmailLogs && (
        <p className="text-sm">
          <Link href="/admin/email-logs" className="font-medium text-primary hover:underline">
            Email logs
          </Link>{" "}
          <span className="text-muted-foreground">— every transactional email sent, and any that failed.</span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {checks.map((check) => (
          <CheckCard key={check.key} check={check} />
        ))}
      </div>
    </div>
  );
}
