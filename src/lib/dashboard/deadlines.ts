import { daysBetween } from "@/lib/graduate-schemes/status";

// Upcoming deadlines for the dashboard: only dates a person or an employer actually recorded — the user's own tracker entries they
// haven't applied for yet, and published graduate schemes with a published closing date. Nothing is estimated, and a scheme with no
// deadline (or a rolling one without a cut-off) simply isn't listed.

export type DeadlineItem = {
  id: string;
  kind: "application" | "scheme";
  title: string;
  subtitle: string;
  /** YYYY-MM-DD */
  date: string;
  /** Whole days from today (0 = today). */
  daysLeft: number;
  href: string;
};

type ApplicationInput = { id: string; jobTitle: string; companyName: string; deadline: string | null; status: string };
type SchemeInput = { slug: string; employer: string; schemeName: string; deadlineOn: string | null };

export const DEADLINE_HORIZON_DAYS = 30;

export function buildDeadlines(input: { applications: ApplicationInput[]; schemes: SchemeInput[]; today: string; horizonDays?: number; limit?: number }): DeadlineItem[] {
  const horizon = input.horizonDays ?? DEADLINE_HORIZON_DAYS;
  const items: DeadlineItem[] = [];

  for (const application of input.applications) {
    // Once applied (or rejected/withdrawn), the deadline no longer needs a nudge.
    if (application.status !== "wishlist" || !application.deadline) continue;
    items.push({ id: `app-${application.id}`, kind: "application", title: `${application.jobTitle} · ${application.companyName}`, subtitle: "Your tracker · not applied yet", date: application.deadline, daysLeft: daysBetween(input.today, application.deadline), href: `/dashboard/applications/${application.id}/edit` });
  }
  for (const scheme of input.schemes) {
    if (!scheme.deadlineOn) continue;
    items.push({ id: `scheme-${scheme.slug}`, kind: "scheme", title: `${scheme.employer} · ${scheme.schemeName}`, subtitle: "Graduate scheme closing date", date: scheme.deadlineOn, daysLeft: daysBetween(input.today, scheme.deadlineOn), href: `/graduate-schemes/${scheme.slug}` });
  }

  return items
    .filter((item) => item.daysLeft >= 0 && item.daysLeft <= horizon)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.title.localeCompare(b.title))
    .slice(0, input.limit ?? 5);
}

export function deadlineLabel(daysLeft: number): string {
  if (daysLeft === 0) return "Today";
  if (daysLeft === 1) return "Tomorrow";
  return `In ${daysLeft} days`;
}
