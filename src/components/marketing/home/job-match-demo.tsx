"use client";

import { motion } from "framer-motion";
import { MapPinIcon, ShieldCheckIcon } from "lucide-react";
import { MockWindow } from "@/components/marketing/mock-window";
import { ScoreRing } from "@/components/marketing/home/score-ring";
import { useDemoStep } from "@/components/marketing/home/use-demo-step";
import { StaggerContainer } from "@/components/motion/stagger-container";
import { StaggerItem } from "@/components/motion/stagger-item";
import { cn } from "@/lib/utils";

const JOBS = [
  {
    role: "Data Analyst",
    company: "Northbridge Partners",
    town: "London",
    score: 91,
    sponsor: true,
    skills: ["SQL", "Python", "Reporting"],
  },
  {
    role: "Graduate Software Engineer",
    company: "Marlow Tech",
    town: "Manchester",
    score: 84,
    sponsor: true,
    skills: ["TypeScript", "APIs", "Testing"],
  },
  {
    role: "Strategy Analyst",
    company: "Alder & Co",
    town: "Bristol",
    score: 76,
    sponsor: false,
    skills: ["Modelling", "Research"],
  },
];

/**
 * Job-match demo: three listings scored against a CV. The spotlight
 * moves down the list, expanding each card's "why it matches" skills:
 * score plus sponsor status side by side, as in the real Job Match tool.
 * Listings are invented for the mockup.
 */
export function JobMatchDemo() {
  const { ref, step } = useDemoStep(JOBS.length, { interval: 2400, startDelay: 1800, hold: 2400 });

  return (
    <div ref={ref}>
      <MockWindow title="Job matches · example">
        <StaggerContainer className="flex flex-col gap-3" staggerDelay={0.12}>
          {JOBS.map((job, index) => {
            const active = index === step;
            return (
              <StaggerItem key={job.role}>
                <motion.div
                  animate={{ scale: active ? 1.015 : 1 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border bg-background p-3.5 transition-colors duration-300",
                    active && "border-primary/50 shadow-elevated",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{job.role}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {job.company} · <MapPinIcon className="size-3" /> {job.town}
                      </p>
                    </div>
                    <ScoreRing value={job.score} size={46} stroke={5} suffix="%" tone={job.score >= 80 ? "primary" : "warning"} />
                  </div>

                  <div
                    className={cn(
                      "grid transition-all duration-300",
                      active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {job.skills.map((skill) => (
                          <span key={skill} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {skill}
                          </span>
                        ))}
                        {job.sponsor && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                            <ShieldCheckIcon className="size-3" />
                            Sponsor
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </MockWindow>
    </div>
  );
}
