import { Section } from "@/components/marketing/section";
import { ActivityIcon, DatabaseIcon, MailIcon, SparklesIcon, GlobeIcon, KeyRoundIcon, HardDriveIcon, CreditCardIcon, BriefcaseIcon, ShieldCheckIcon } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { StaggerContainer } from "@/components/motion/stagger-container";
import { StaggerItem } from "@/components/motion/stagger-item";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { runAllHealthChecks } from "@/lib/health/checks";
import type { HealthStatus } from "@/lib/health/types";
import { buildMetadata } from "@/lib/seo/metadata";

// Runs every check on every request rather than at build time — this
// page's whole point is a live read, not a cached one.
export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "System Status",
  description: "Live status of JobPilot AI's core services, including the website, sign-in and database, checked each time you load this page.",
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

  const services: { name: string; description: string; status: PublicServiceStatus; icon: typeof GlobeIcon }[] = [
    { name: "Website", description: "Public site and application", status: "unmonitored", icon: GlobeIcon },
    { name: "Database", description: "Supabase Postgres", status: statusByKey.get("database") ?? "unmonitored", icon: DatabaseIcon },
    { name: "Authentication", description: "Supabase Auth", status: "unmonitored", icon: KeyRoundIcon },
    { name: "File storage", description: "Supabase Storage", status: "unmonitored", icon: HardDriveIcon },
    { name: "AI features", description: "CV, cover letter, and interview AI tools", status: statusByKey.get("ai") ?? "unmonitored", icon: SparklesIcon },
    { name: "Payments", description: "Subscriptions and billing", status: statusByKey.get("stripe") ?? "unmonitored", icon: CreditCardIcon },
    { name: "Email delivery", description: "Transactional email", status: statusByKey.get("email") ?? "unmonitored", icon: MailIcon },
    { name: "Job feed", description: "Live job listings", status: statusByKey.get("job_sync") ?? "unmonitored", icon: BriefcaseIcon },
    { name: "Visa sponsor register", description: "UK sponsor licence data", status: statusByKey.get("sponsor_sync") ?? "unmonitored", icon: ShieldCheckIcon },
  ];

  // Derived only from the statuses above, so the headline can never
  // claim more than the rows underneath it show.
  const monitored = services.filter((service) => service.status !== "unmonitored" && service.status !== "not_configured");
  const anyDown = monitored.some((service) => service.status === "down");
  const anyDegraded = monitored.some((service) => service.status === "degraded");
  const overall = anyDown
    ? { label: "Some services are down", tone: "text-destructive", dot: "bg-destructive" }
    : anyDegraded
      ? { label: "Some services are degraded", tone: "text-warning", dot: "bg-warning" }
      : monitored.length > 0
        ? { label: "All monitored services operational", tone: "text-success", dot: "bg-success" }
        : { label: "Status checks are being set up", tone: "text-muted-foreground", dot: "bg-muted-foreground" };

  return (
    <>
      <PageHero
        eyebrow="Status"
        title={
          <>
            System <GradientText>status</GradientText>
          </>
        }
        description="Live checks across our core services, refreshed on every page load."
        badge={
          <span className="inline-flex items-center gap-2.5 rounded-full border bg-card/80 px-4 py-2 text-sm font-medium shadow-card">
            <span className="relative flex size-2.5">
              <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", overall.dot)} />
              <span className={cn("relative inline-flex size-2.5 rounded-full", overall.dot)} />
            </span>
            <span className={overall.tone}>{overall.label}</span>
          </span>
        }
        className="sm:pb-8"
      />

      <Section className="pt-0" decorative={false}>
        <div className="mx-auto flex max-w-2xl flex-col gap-8">
          <StaggerContainer className="flex flex-col gap-3" staggerDelay={0.05}>
            {services.map((service) => (
              <StaggerItem
                key={service.name}
                className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4 shadow-card transition-all hover:border-primary/30 hover:shadow-elevated"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <service.icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  </div>
                </div>
                <StatusBadge status={service.status} />
              </StaggerItem>
            ))}
          </StaggerContainer>

          <p className="text-center text-xs text-muted-foreground">
            <ActivityIcon className="mr-1 inline size-3.5" aria-hidden="true" />
            Last checked <time dateTime={checkedAt.toISOString()}>{checkedAt.toLocaleString("en-GB")}</time> — refreshes on
            every page load.
          </p>
        </div>
      </Section>
    </>
  );
}
