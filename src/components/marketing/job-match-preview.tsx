import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function JobMatchRow({
  company,
  role,
  score,
  sponsor,
}: {
  company: string;
  role: string;
  score: number;
  sponsor: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{role}</p>
        <p className="text-xs text-muted-foreground">{company}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold text-primary">{score}%</span>
        {sponsor && (
          <Badge variant="secondary" className="text-[10px]">
            Sponsor
          </Badge>
        )}
      </div>
    </div>
  );
}

/** An illustrative match list — a mockup for marketing, not real listings. */
export function JobMatchPreview() {
  return (
    <Card className="mx-auto w-full max-w-sm gap-3 p-6">
      <p className="mb-1 text-sm font-medium">Matched for you</p>
      <JobMatchRow company="Northbridge Partners" role="Data Analyst" score={91} sponsor />
      <JobMatchRow company="Marlow Tech" role="Graduate Software Engineer" score={84} sponsor />
      <JobMatchRow company="Alder & Co" role="Strategy Analyst" score={76} sponsor={false} />
    </Card>
  );
}
