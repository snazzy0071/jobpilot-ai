"use client";

import { motion } from "framer-motion";
import { ShieldCheckIcon } from "lucide-react";
import { MockWindow } from "@/components/marketing/mock-window";
import { useDemoStep } from "@/components/marketing/home/use-demo-step";
import { cn } from "@/lib/utils";

const STAGES = ["Wishlist", "Applied", "Interview", "Offer"];

// Column index of each card at each of the four steps. Fenwick is the
// one that travels the whole pipeline; Marlow follows it one stage
// behind; Alder waits in Applied.
const CARDS = [
  { id: "fenwick", company: "Fenwick", role: "Analyst", sponsor: true, at: [0, 1, 2, 3] },
  { id: "marlow", company: "Marlow", role: "Engineer", sponsor: true, at: [0, 0, 1, 1] },
  { id: "alder", company: "Alder", role: "Grad scheme", sponsor: false, at: [1, 1, 1, 2] },
];

const CAPTIONS = [
  "Saved to the wishlist",
  "Applied: sponsor status stays on the card",
  "Interview booked",
  "Offer received",
];

/**
 * Application-pipeline demo: cards glide between the tracker's stages
 * (shared layout animation, so the movement is real, not a fade), with a
 * caption for each beat. Stage names match the real Job Tracker board.
 */
export function PipelineDemo() {
  const { ref, step } = useDemoStep(4, { interval: 1700, startDelay: 900, hold: 3000 });

  return (
    <div ref={ref}>
      <MockWindow title="Job Tracker · example">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {STAGES.map((stage, column) => {
              const cards = CARDS.filter((card) => card.at[step] === column);
              return (
                <div key={stage} className="flex min-h-[9.5rem] flex-col gap-2 rounded-xl bg-muted/40 p-1.5 sm:p-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-[9px] font-semibold tracking-wide text-muted-foreground uppercase sm:text-[11px]">
                      {stage}
                    </p>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{cards.length}</span>
                  </div>
                  {cards.map((card) => (
                    <motion.div
                      key={card.id}
                      layoutId={card.id}
                      layout
                      transition={{ type: "spring", stiffness: 260, damping: 28 }}
                      className={cn(
                        "flex flex-col gap-1 rounded-lg border bg-card p-1.5 shadow-card sm:p-2",
                        card.id === "fenwick" && "border-primary/50",
                      )}
                    >
                      <p className="truncate text-[10px] font-semibold sm:text-xs">{card.company}</p>
                      <p className="truncate text-[9px] text-muted-foreground sm:text-[11px]">{card.role}</p>
                      {card.sponsor && (
                        <span className="flex items-center gap-0.5 text-[9px] font-medium text-success">
                          <ShieldCheckIcon className="size-2.5" />
                          <span className="hidden sm:inline">Sponsor</span>
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground" aria-live="off">
            {CAPTIONS[step]}
          </p>
        </div>
      </MockWindow>
    </div>
  );
}
