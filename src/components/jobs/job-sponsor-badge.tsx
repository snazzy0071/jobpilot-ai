import Link from "next/link";
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SPONSOR_RATING_LABELS } from "@/lib/sponsors/types";
import type { JobSponsorMatch } from "@/lib/jobs/sponsor-match";

/**
 * The one place a sponsorship claim is ever rendered for a job — kept to exactly the two states
 * src/lib/jobs/sponsor-match.ts makes assertable: 'confirmed_sponsor' (unambiguous match) shows the tinted "Licensed
 * sponsor" chip, linking to that company's register entry; 'unconfirmed' (a possible match that is not a confirmed
 * identity) shows "Unconfirmed", never a definite yes/no. 'not_found' renders nothing at all, deliberately — most job
 * listings were never sponsorship-relevant, and a "not on register" badge on every ordinary job would read as a
 * claim that this employer can't sponsor, which the register cannot support.
 */
export function JobSponsorBadge({ match }: { match: JobSponsorMatch }) {
  if (match.status === "confirmed_sponsor") {
    const best = match.sponsors[0];
    const label = best ? `Licensed sponsor (${SPONSOR_RATING_LABELS[best.rating]}) — view on the register` : "Licensed sponsor";
    const chip = (
      <Badge variant="tinted" className="gap-1.5">
        <ShieldCheck className="size-3" />
        Licensed sponsor
      </Badge>
    );
    return best ? (
      <Link href={`/visa-sponsors/companies/${best.sponsorId}`} aria-label={label} title={label}>
        {chip}
      </Link>
    ) : (
      chip
    );
  }

  if (match.status === "unconfirmed") {
    return (
      <Badge variant="outline" className="gap-1.5 text-muted-foreground" title="A possible match was found on the sponsor register, but it isn't a confirmed identity match.">
        <ShieldQuestion className="size-3" />
        Unconfirmed
      </Badge>
    );
  }

  return null;
}
