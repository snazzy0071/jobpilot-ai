"use client";

import { motion } from "framer-motion";
import { BuildingIcon, MapPinIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { Counter } from "@/components/motion/counter";

const RESULTS = [
  { name: "Northbridge Partners", location: "London", route: "Skilled Worker" },
  { name: "Marlow Tech", location: "Manchester", route: "Skilled Worker" },
  { name: "Alder & Co", location: "Bristol", route: "Global Business Mobility" },
];

/**
 * An illustrative sponsor search result list — a mockup for marketing
 * (invented company names, not real register rows), paired with the
 * one real number on the homepage: `total`, read live from
 * `getTotalSponsorCount()` on the server and passed in as a prop.
 */
export function SponsorSearchPreview({ total }: { total: number }) {
  return (
    <Card className="mx-auto w-full max-w-lg gap-4 p-6">
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <SearchIcon className="size-4" />
        <span>Search by company, town or route&hellip;</span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total > 0 ? <Counter value={total} suffix=" sponsors" /> : "Licensed sponsors"} on the register
        </span>
        <span>Synced weekly</span>
      </div>

      <div className="flex flex-col gap-2">
        {RESULTS.map((sponsor, index) => (
          <Reveal key={sponsor.name} delay={index * 0.12}>
            <motion.div
              whileHover={{ y: -2 }}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BuildingIcon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{sponsor.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPinIcon className="size-3" />
                    {sponsor.location}
                  </p>
                </div>
              </div>
              <Badge variant="tinted" className="shrink-0 text-[10px]">
                {sponsor.route}
              </Badge>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </Card>
  );
}
