import { Card } from "@/components/ui/card";
import { Line } from "@/components/marketing/wireframe-line";

/** An illustrative CV layout — a mockup for marketing, not a real screenshot. */
export function CvPreview() {
  return (
    <Card className="mx-auto w-full max-w-sm gap-4 p-6">
      <div className="flex flex-col gap-1 border-b pb-4">
        <p className="text-base font-semibold">Alex Morgan</p>
        <p className="text-sm text-muted-foreground">Software Engineer &middot; London, UK</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Summary</p>
        <Line width="full" />
        <Line width="3/4" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Experience</p>
        <Line width="1/2" />
        <Line width="full" />
        <Line width="full" />
        <Line width="1/3" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Skills</p>
        <Line width="3/4" />
      </div>
    </Card>
  );
}
