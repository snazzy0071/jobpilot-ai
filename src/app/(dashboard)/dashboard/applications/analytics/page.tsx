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
      </div>

      <ApplicationFunnelStats analytics={analytics} />
    </div>
  );
}
