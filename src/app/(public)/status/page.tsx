import { Section } from "@/components/marketing/section";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Badge } from "@/components/ui/badge";
import { runAllHealthChecks } from "@/lib/health/checks";
import type { HealthStatus } from "@/lib/health/types";
import { buildMetadata } from "@/lib/seo/metadata";

// Runs every check on every request rather than at build time — this
// page's whole point is a live read, not a cached one.
export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "System Status",
  description: "Live status of JobPilot AI's core services.",
  path: "/status",
});

// A local, narrower status: everything runAllHealthChecks() can return
// (src/lib/health/types.ts's HealthStatus), plus "unmonitored" for the
// services this task never built a real check for (Website,
// Authentication, File storage) — kept honestly distinct from
// "not_configured" (a check that actually ran and found nothing set
// up) internally, but deliberately shown with the same public label
// below: a visitor doesn't need to know *why* something isn't listed
// as live, only that it isn't.
type PublicServiceStatus = HealthStatus | "unmonitored";

function StatusBadge({ status }: { status: PublicServiceStatus }) {
  if (status === "operational") return <Badge variant="outline" className="border-success/30 bg-success/15 text-success">Operational</Badge>;
  if (status === "degraded") return <Badge variant="outline" className="border-warning/30 bg-warning/15 text-warning">Degraded</Badge>;
  if (status === "down") return <Badge variant="destructive">Down</Badge>;
  return <Badge variant="outline">Not monitored yet</Badge>;
}

export default async function StatusPage() {
  // Every number/label here comes straight from
  // src/lib/health/checks.ts's own `status` field — never `detail`,
  // which is where any real diagnostic text (a caught error's message,
  // a per-source sync breakdown) lives. That's the entire "safe
  // summarized" boundary this page exists to respect: it structurally
  // can't leak detail it never reads in the first place, not just by
  // convention.
  const checks = await runAllHealthChecks();
  const statusByKey = new Map(checks.map((check) => [check.key, check.status]));
  const checkedAt = new Date();

  const services: { name: string; description: string; status: PublicServiceStatus }[] = [
    { name: "Website", description: "Public site and application", status: "unmonitored" },
    { name: "Database", description: "Supabase Postgres", status: statusByKey.get("database") ?? "unmonitored" },
    { name: "Authentication", description: "Supabase Auth", status: "unmonitored" },
    { name: "File storage", description: "Supabase Storage", status: "unmonitored" },
    { name: "AI features", description: "CV, cover letter, and interview AI tools", status: statusByKey.get("ai") ?? "unmonitored" },
    { name: "Payments", description: "Subscriptions and billing", status: statusByKey.get("stripe") ?? "unmonitored" },
    { name: "Email delivery", description: "Transactional email", status: statusByKey.get("email") ?? "unmonitored" },
    { name: "Job feed", description: "Live job listings", status: statusByKey.get("job_sync") ?? "unmonitored" },
    { name: "Visa sponsor register", description: "UK sponsor licence data", status: statusByKey.get("sponsor_sync") ?? "unmonitored" },
  ];

  return (
    <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-24 sm:pt-32">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Eyebrow>Status</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">System status</h1>
          <p className="text-lg text-muted-foreground">Live checks across our core services, refreshed on every page load.</p>
        </div>

        <div className="flex flex-col gap-3">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-sm text-muted-foreground">{service.description}</p>
              </div>
              <StatusBadge status={service.status} />
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Last checked <time dateTime={checkedAt.toISOString()}>{checkedAt.toLocaleString("en-GB")}</time> — refreshes on
          every page load.
        </p>
      </div>
    </Section>
  );
}
