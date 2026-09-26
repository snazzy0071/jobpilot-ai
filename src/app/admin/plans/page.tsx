import Link from "next/link";
import { AlertTriangleIcon, BanknoteIcon, CreditCardIcon, GiftIcon, AlertCircleIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/admin/overview/panels";
import { MetricCard } from "@/components/admin/overview/metric-card";
import { formatCount } from "@/components/admin/overview/format";
import { getAdminPlansData } from "@/lib/admin/plans/queries";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { active: "Active", trialing: "Trialing", past_due: "Past due", canceled: "Cancelled", incomplete: "Incomplete", incomplete_expired: "Expired" };

function entitlementSummary(entitlements: Record<string, unknown>): { on: string[]; limits: string[] } {
  const on: string[] = [];
  const limits: string[] = [];
  for (const [key, value] of Object.entries(entitlements)) {
    const label = key.replace(/_/g, " ");
    if (value === true) on.push(label);
    else if (value === null) limits.push(`${label}: unlimited`);
    else if (typeof value === "number") limits.push(`${label}: ${value}`);
  }
  return { on, limits };
}

/**
 * Read-only by design: prices and entitlements live in the `plans` table and Stripe, and changing either is a billing change that
 * belongs in a migration and the Stripe dashboard, not a form. Every number here is counted from the database; revenue counts only
 * subscriptions Stripe actually bills.
 */
export default async function AdminPlansPage() {
  const { billing, plans, recent, error } = await getAdminPlansData();
  const money = (pence: number) => formatCount(pence, "gbp");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Plans &amp; subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Plans as configured, who is on them, and the revenue Stripe is actually billing. Read-only.</p>
      </div>

      {error && (
        <Card className="flex-row items-start gap-2 border-destructive/40 p-3 text-sm" role="alert">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>{error}</p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="MRR" icon={BanknoteIcon} value={billing.mrrPence} kind="gbp" caption={`ARR ${money(billing.arrPence)}`} />
        <MetricCard label="Paying subscriptions" icon={CreditCardIcon} value={billing.activePaid} caption={`${billing.trialing} trialing · ${billing.pastDue} past due`} />
        <MetricCard label="Complimentary" icon={GiftIcon} value={billing.complimentary} caption="Paid plan, nothing billed (access codes, grants)" />
        <MetricCard label="Failed payments (30d)" icon={AlertCircleIcon} value={billing.paymentsFailed30d} caption={`${billing.newSubscriptions30d} new · ${billing.cancellations30d} cancelled`} />
      </div>

      <Panel title="Plans" description="Subscribers are counted per plan by status. Institution licences give their members the licence's plan while in force; those members are not subscribers.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="plans-table">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-medium">Plan</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Monthly</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Annual</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Active</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Trial</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Past due</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Cancelled</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">MRR</th>
                <th scope="col" className="py-1.5 pl-2 text-right font-medium">Licences</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b last:border-0" data-plan={plan.slug}>
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                    {plan.name} {!plan.isActive && <Badge variant="secondary">Retired</Badge>}
                  </th>
                  <td className="px-2 py-1.5 text-right">{money(plan.monthlyPricePence)}</td>
                  <td className="px-2 py-1.5 text-right">{money(plan.annualPricePence)}</td>
                  <td className="px-2 py-1.5 text-right" data-col="active">{plan.active}</td>
                  <td className="px-2 py-1.5 text-right">{plan.trialing}</td>
                  <td className="px-2 py-1.5 text-right">{plan.pastDue}</td>
                  <td className="px-2 py-1.5 text-right">{plan.canceled}</td>
                  <td className="px-2 py-1.5 text-right" data-col="mrr">{plan.mrrPence > 0 ? money(plan.mrrPence) : "—"}</td>
                  <td className="py-1.5 pl-2 text-right">{plan.licences > 0 ? `${plan.licences} (${plan.licensedSeats} seats)` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        {plans.map((plan) => {
          const { on, limits } = entitlementSummary(plan.entitlements);
          return (
            <Panel key={plan.id} title={`${plan.name}: what it includes`}>
              {on.length + limits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entitlements configured.</p>
              ) : (
                <div className="flex flex-col gap-2 text-xs">
                  {limits.length > 0 && <p className="text-muted-foreground">{limits.join(" · ")}</p>}
                  {on.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {on.map((feature) => (
                        <li key={feature}>
                          <Badge variant="secondary">{feature}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      <Panel title="Latest paid-plan subscriptions" description="The 25 most recently changed subscriptions on a paid plan. Source shows whether Stripe bills it or it was granted.">
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No paid-plan subscriptions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-3 font-medium">User</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Plan</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Status</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Cycle</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Source</th>
                  <th scope="col" className="py-1.5 pl-2 font-medium">Period ends</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.userId} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">
                      <Link href={`/admin/users/${row.userId}`} className="text-primary hover:underline">
                        {row.fullName ?? "Unnamed user"}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5">{row.planName}</td>
                    <td className="px-2 py-1.5">
                      {STATUS_LABEL[row.status] ?? row.status}
                      {row.cancelAtPeriodEnd ? " (ends)" : ""}
                    </td>
                    <td className="px-2 py-1.5">{row.billingCycle ?? "—"}</td>
                    <td className="px-2 py-1.5">{row.source === "stripe" ? "Stripe" : "Granted"}</td>
                    <td className="py-1.5 pl-2">{row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleDateString("en-GB") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
