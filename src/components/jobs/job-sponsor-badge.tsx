import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { JobSponsorMatch } from "@/lib/jobs/sponsor-match";

/**
 * The one place a sponsorship claim is ever rendered for a job — kept
 * to exactly the two states src/lib/jobs/sponsor-match.ts's own status
 * enum makes assertable: 'confirmed_sponsor' (unambiguous match) shows
 * the tinted "Licensed sponsor" chip; anything else that still found a
 * candidate ('unconfirmed') shows "Unconfirmed", never a definite
 * yes/no. 'not_found' renders nothing at all, deliberately — most job
 * listings were never sponsorship-relevant in the first place, and a
 * "not on register" badge on every ordinary job would read as a
 * negative claim ("this employer can't sponsor") this module's own
 * rules explicitly don't support making.
 */
export function JobSponsorBadge({ match }: { match: JobSponsorMatch }) {
  if (match.status === "confirmed_sponsor") {
    return (
      <Badge variant="tinted" className="gap-1.5">
        <ShieldCheck className="size-3" />
        Licensed sponsor
      </Badge>
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
