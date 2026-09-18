import { Card } from "@/components/ui/card";

function TrackerColumn({ title, cards }: { title: string; cards: string[] }) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="flex flex-col gap-2">
        {cards.length > 0 ? (
          cards.map((card) => (
            <div key={card} className="rounded-md border bg-background p-2 text-xs leading-snug">
              {card}
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground/40">
            &mdash;
          </div>
        )}
      </div>
    </div>
  );
}

/** An illustrative kanban board — a mockup for marketing, not a real board. */
export function JobTrackerPreview() {
  return (
    <Card className="mx-auto w-full max-w-2xl gap-4 p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TrackerColumn title="Wishlist" cards={["Northbridge Partners · Analyst"]} />
        <TrackerColumn
          title="Applied"
          cards={["Alder & Co · Grad Scheme", "Marlow Tech · Software Engineer"]}
        />
        <TrackerColumn title="Interview" cards={["Fenwick Group · Analyst"]} />
        <TrackerColumn title="Offer" cards={[]} />
      </div>
    </Card>
  );
}
