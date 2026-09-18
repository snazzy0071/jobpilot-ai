import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAdminUserDetail } from "@/lib/admin/users/queries";
import { UserDangerActions } from "@/components/admin/users/user-danger-actions";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAdminUserDetail(id);
  if (!user) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/users"><ArrowLeftIcon /> Users</Link>} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{user.fullName ?? user.email ?? "Unnamed account"}</h1>
          <p className="mt-1 text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant={user.role === "admin" ? "tinted" : "outline"}>{user.role}</Badge>
      </div>

      <Card className="gap-3 p-6">
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Joined</p>
            <p className="text-sm">{formatDate(user.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Institution</p>
            <p className="text-sm">
              {user.institution ? (
                <>
                  {user.institution.name} ({user.institution.role})
                </>
              ) : (
                "None"
              )}
            </p>
          </div>
        </div>
      </Card>

      <Card className="gap-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Subscription</h2>
          {user.subscription?.stripeCustomerId && (
            <a
              href={`https://dashboard.stripe.com/customers/${user.subscription.stripeCustomerId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            >
              View in Stripe <ExternalLinkIcon className="size-3" />
            </a>
          )}
        </div>
        {user.subscription ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="text-sm">{user.subscription.planName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm">
                {user.subscription.status}
                {user.subscription.cancelAtPeriodEnd ? " (canceling at period end)" : ""}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Billing cycle</p>
              <p className="text-sm">{user.subscription.billingCycle ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current period ends</p>
              <p className="text-sm">{formatDate(user.subscription.currentPeriodEnd)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Free plan — no subscription on record.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Status shown here is exactly what Stripe last told this app via webhook — never editable directly from this page.
        </p>
      </Card>

      <Card className="gap-3 p-6">
        <h2 className="text-sm font-semibold">Access code redemptions</h2>
        {user.accessCodeRedemptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No access codes redeemed.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {user.accessCodeRedemptions.map((redemption, index) => (
              <li key={index} className="flex items-center justify-between">
                <span>
                  {redemption.code} — {redemption.label}
                </span>
                <span className="text-muted-foreground">{formatDate(redemption.redeemedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="gap-3 p-6">
        <h2 className="text-sm font-semibold">Actions</h2>
        <UserDangerActions
          userId={user.id}
          label={user.fullName ?? user.email ?? "this account"}
          hasCancellableSubscription={!!user.subscription?.stripeSubscriptionId && !user.subscription.cancelAtPeriodEnd}
        />
      </Card>
    </div>
  );
}
