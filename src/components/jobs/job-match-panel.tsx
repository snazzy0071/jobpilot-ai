"use client";

import { useState } from "react";
import { Loader2Icon, AlertCircleIcon, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { runJobMatch } from "@/lib/jobs/matching/actions";
import { JOB_MATCH_VERDICT_LABELS, type JobMatch, type JobMatchComponents } from "@/lib/jobs/types";

const VERDICT_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  strong_match: "default",
  worth_applying: "secondary",
  stretch: "outline",
  not_a_fit: "destructive",
};

const COMPONENT_LABELS: Record<keyof JobMatchComponents, string> = {
  coreSkills: "Core skills",
  techFunctionalSkills: "Tech / functional skills",
  domainFit: "Domain fit",
  seniority: "Seniority",
};

function ComponentBar({ label, score, summary }: { label: string; score: number; summary: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{score}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{summary}</p>
    </div>
  );
}

function MatchBreakdown({ match }: { match: JobMatch }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={VERDICT_BADGE_VARIANT[match.verdict] ?? "outline"}>{JOB_MATCH_VERDICT_LABELS[match.verdict]}</Badge>
        <span className="flex items-center gap-1 text-sm font-medium">
          <TrendingUp className="size-3.5 text-primary" />
          {match.matchScore}/100
        </span>
      </div>

      <Accordion>
        <AccordionItem value="breakdown">
          <AccordionTrigger className="text-xs text-muted-foreground">Match breakdown</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-3 text-sm">
              {(Object.keys(COMPONENT_LABELS) as (keyof JobMatchComponents)[]).map((key) => (
                <ComponentBar key={key} label={COMPONENT_LABELS[key]} score={match.components[key].score} summary={match.components[key].summary} />
              ))}
              {match.gaps.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Gaps</p>
                  <ul className="list-inside list-disc text-xs text-muted-foreground">
                    {match.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/**
 * Shows an existing job_matches score for this (job, cv) pair
 * immediately if one was already computed (`initialMatch`, batched
 * server-side for the whole feed page — src/lib/jobs/queries.ts's
 * getJobMatchesForCv). Otherwise offers a "Score this job" button that
 * runs the real AI scoring on click — never automatically on page
 * load, since that would mean an AI call per visible job every time the
 * feed renders.
 */
export function JobMatchPanel({ jobId, cvId, initialMatch }: { jobId: string; cvId: string; initialMatch: JobMatch | null }) {
  const [match, setMatch] = useState<JobMatch | null>(initialMatch);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScore() {
    setLoading(true);
    setError(null);
    const result = await runJobMatch({ jobId, cvId });
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setMatch(result.match);
  }

  if (match) return <MatchBreakdown match={match} />;

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleScore} disabled={loading}>
        {loading ? (
          <>
            <Loader2Icon className="size-3.5 animate-spin" /> Scoring…
          </>
        ) : (
          "Score this job"
        )}
      </Button>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircleIcon className="size-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
