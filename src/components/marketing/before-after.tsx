import { Card } from "@/components/ui/card";

export function BeforeAfter({ before, after }: { before: string; after: string }) {
  return (
    <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
      <Card className="gap-2 p-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Before
        </p>
        <p className="text-sm text-muted-foreground">{before}</p>
      </Card>
      <Card className="gap-2 border-primary/40 bg-primary/5 p-5">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">After</p>
        <p className="text-sm">{after}</p>
      </Card>
    </div>
  );
}
