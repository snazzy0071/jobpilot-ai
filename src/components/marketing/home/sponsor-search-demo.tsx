"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheckIcon, BuildingIcon, MapPinIcon, SearchIcon } from "lucide-react";
import { MockWindow } from "@/components/marketing/mock-window";
import { useDemoStep } from "@/components/marketing/home/use-demo-step";
import { Counter } from "@/components/motion/counter";

const SPONSORS = [
  { name: "Northbridge Partners", town: "London", route: "Skilled Worker" },
  { name: "Marlow Tech", town: "Manchester", route: "Skilled Worker" },
  { name: "Alder & Co", town: "Bristol", route: "Global Business Mobility" },
  { name: "Fenwick Group", town: "Leeds", route: "Skilled Worker" },
];

const QUERY = "Marlow";
// Steps: a short pause, one step per typed letter, then a hold on the result.
const TYPING_STEPS = QUERY.length;
const TOTAL_STEPS = TYPING_STEPS + 3;

/**
 * Sponsor-search demo: a query types itself into the search box and the
 * result list narrows to match: the real register search, staged.
 * Company names are invented for the mockup; the headline total is the
 * live register count passed in from the server.
 */
export function SponsorSearchDemo({ total }: { total: number }) {
  const { ref, step } = useDemoStep(TOTAL_STEPS, { interval: 170, startDelay: 700, hold: 2800 });
  const typed = QUERY.slice(0, Math.max(0, Math.min(step, TYPING_STEPS)));
  const results = typed
    ? SPONSORS.filter((sponsor) => sponsor.name.toLowerCase().includes(typed.toLowerCase()))
    : SPONSORS;
  const done = step >= TYPING_STEPS;

  return (
    <div ref={ref}>
      <MockWindow title="Visa sponsors · example">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-h-5 flex-1 truncate" aria-label="Search query">
              {typed || <span className="text-muted-foreground">Search by company, town or route…</span>}
              {typed && !done && <span className="ml-px inline-block h-4 w-px translate-y-0.5 bg-primary" aria-hidden="true" />}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {total > 0 ? (
                <>
                  <Counter value={total} /> licensed sponsors
                </>
              ) : (
                "Licensed sponsors"
              )}{" "}
              on the register
            </span>
            <span>
              {results.length} shown
            </span>
          </div>

          <ul className="relative flex min-h-[13.5rem] flex-col gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {results.map((sponsor) => (
                <motion.li
                  key={sponsor.name}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                    done && results.length === 1 ? "border-primary/50 bg-primary/5 shadow-elevated" : "bg-background"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BuildingIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{sponsor.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPinIcon className="size-3" />
                        {sponsor.town} · {sponsor.route}
                      </p>
                    </div>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-medium text-success sm:inline-flex">
                    <BadgeCheckIcon className="size-3" />
                    Licensed
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </MockWindow>
    </div>
  );
}
