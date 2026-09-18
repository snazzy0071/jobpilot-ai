import Link from "next/link";
import { UsersIcon, MailIcon, ShieldCheckIcon, ArmchairIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireInstitutionAdmin } from "@/lib/auth/session";
import { getInstitutionOverview } from "@/lib/institutions/admin/queries";

export const dynamic = "force-dynamic";

function StatTile({ icon: Icon, label, value, caption, href }: { icon: typeof UsersIcon; label: string; value: string; caption?: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="gap-1 p-4 transition-colors hover:bg-muted/40">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-4" /> {label}
        </div>
        <p className="font-heading text-2xl font-semibold tracking-tight">{value}</p>
        {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      </Card>
    </Link>
  );
}

export default async function InstitutionAdminOverviewPage() {
  const { institutionId } = await requireInstitutionAdmin();
  const overview = await getInstitutionOverview(institutionId);

  if (!overview) {
    return <p className="text-muted-foreground">Your institution couldn&apos;t be found.</p>;
  }

  const { institution, licence, adminCount, memberCount, pendingInviteCount, seatsUsed, seatsTotal } = overview;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{institution.name}</h1>
        <p className="mt-1 text-muted-foreground">Cohort overview and licence status for your institution.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={ArmchairIcon}
          label="Seats used"
          value={seatsTotal !== null ? `${seatsUsed} / ${seatsTotal}` : `${seatsUsed}`}
          caption={seatsTotal === null ? "No active licence" : undefined}
          href="/institution-admin/seats"
        />
        <StatTile icon={UsersIcon} label="Members" value={`${adminCount + memberCount}`} caption={`${adminCount} admin${adminCount === 1 ? "" : "s"}`} href="/institution-admin/members" />
        <StatTile icon={MailIcon} label="Pending invites" value={`${pendingInviteCount}`} href="/institution-admin/invites" />
        <StatTile
          icon={ShieldCheckIcon}
          label="Licence"
          value={licence ? licence.planName : "None"}
          caption={licence ? (licence.expiresAt ? `Renews ${new Date(licence.expiresAt).toLocaleDateString("en-GB")}` : "No expiry") : "Contact JobPilot"}
          href="/institution-admin/licence"
        />
      </div>

      {!licence && (
        <Card className="flex-row items-center gap-2 p-4 text-sm text-muted-foreground">
          Your institution has no active licence yet — members and invites can&apos;t be added until one is set up.
          <Badge variant="outline" className="ml-auto">
            Contact JobPilot
          </Badge>
        </Card>
      )}
    </div>
  );
}
