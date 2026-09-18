import { Card } from "@/components/ui/card";
import { requireInstitutionAdmin } from "@/lib/auth/session";
import { getInstitutionOverview } from "@/lib/institutions/admin/queries";

export const dynamic = "force-dynamic";

function SeatBar({ label, count, total }: { label: string; count: number; total: number }) {
  const width = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{count.toLocaleString()}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function InstitutionAdminSeatsPage() {
  const { institutionId } = await requireInstitutionAdmin();
  const overview = await getInstitutionOverview(institutionId);

  if (!overview) {
    return <p className="text-muted-foreground">Your institution couldn&apos;t be found.</p>;
  }

  const { licence, adminCount, memberCount, pendingInviteCount, seatsUsed, seatsTotal } = overview;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Seats</h1>
        <p className="mt-1 text-muted-foreground">
          {seatsTotal !== null
            ? `${seatsUsed} of ${seatsTotal} seats in use.`
            : "Your institution has no active licence, so no seats are available."}
        </p>
      </div>

      {licence && seatsTotal !== null ? (
        <Card className="gap-4 p-6">
          <SeatBar label="In use" count={seatsUsed} total={seatsTotal} />
          <div className="grid gap-4 pt-2 sm:grid-cols-3">
            <div>
              <p className="text-2xl font-semibold">{adminCount}</p>
              <p className="text-xs text-muted-foreground">Administrators</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{memberCount}</p>
              <p className="text-xs text-muted-foreground">Members</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{pendingInviteCount}</p>
              <p className="text-xs text-muted-foreground">Pending invites</p>
            </div>
          </div>
          <p className="pt-2 text-xs text-muted-foreground">
            {seatsTotal - seatsUsed > 0
              ? `${seatsTotal - seatsUsed} seat${seatsTotal - seatsUsed === 1 ? "" : "s"} available — a pending invite reserves a seat until it's accepted or revoked.`
              : "No seats left — revoke an unused invite or contact JobPilot to add more seats."}
          </p>
        </Card>
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">Contact JobPilot to set up a licence for your institution.</Card>
      )}
    </div>
  );
}
