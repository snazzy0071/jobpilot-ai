import { Card } from "@/components/ui/card";

/** An illustrative headline rewrite — a mockup for marketing, not a real profile. */
export function LinkedInPreview() {
  return (
    <Card className="mx-auto w-full max-w-sm gap-4 p-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Before
        </p>
        <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/50">
          Student at University of Manchester
        </p>
      </div>
      <div className="flex flex-col gap-2 border-t pt-4">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">After</p>
        <p className="text-sm font-medium">
          Data Analytics Graduate &middot; Python, SQL, Power BI &middot; Open to Graduate Roles
          in London
        </p>
      </div>
      <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
        <span>Keyword coverage</span>
        <span className="font-medium text-primary">+6 terms</span>
      </div>
    </Card>
  );
}
