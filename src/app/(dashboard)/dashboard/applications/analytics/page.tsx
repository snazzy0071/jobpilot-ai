import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationFunnelStats } from "@/components/applications/application-funnel-stats";
import { requireUser } from "@/lib/auth/session";
import { getApplicationFunnelAnalytics } from "@/lib/applications/analytics";

export const dynamic = "force-dynamic";

export default async function ApplicationAnalyticsPage() {
  const user = await requireUser();
  const analytics = await getApplicationFunnelAnalytics(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2" render={<Link href="/dashboard/applications" />}>
          <ArrowLeft className="size-3.5" /> Back to applications
        </Button>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Funnel analytics</h1>
        <p className="mt-1 text-muted-foreground">Computed from your own tracked applications — never example data.</p>
      </div>

      <ApplicationFunnelStats analytics={analytics} />
    </div>
  );
}
