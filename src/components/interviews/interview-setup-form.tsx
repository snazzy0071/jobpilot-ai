"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInterviewSession } from "@/lib/interviews/actions";
import { purchaseVoiceTopup } from "@/lib/interviews/topup-actions";
import { VOICE_TOPUP_CREDITS } from "@/lib/interviews/topup-config";
import { BillingActionButton } from "@/components/settings/billing-action-button";
import {
  INTERVIEW_MODES,
  INTERVIEW_MODE_LABELS,
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_DIFFICULTY_LABELS,
  INTERVIEW_COMPETENCY_LABELS,
  type InterviewMode,
  type InterviewDifficulty,
  type InterviewCompetency,
} from "@/lib/interviews/types";
import type { CvListItem } from "@/lib/cvs/types";
import type { UsageCheck } from "@/lib/entitlements/types";

export type InterviewRepractice = {
  company: string;
  role: string;
  focusCompetencies: InterviewCompetency[];
  fromSessionId: string;
};

/** One line of "X of Y used this month" / "Not included in your plan" per mode — the UI half of "respect plan/mode limits". The Server Action's own generateStructuredGated guard is what actually enforces it; this is just so a locked/exhausted mode is disabled and explained before the user picks it, not after a failed submit. */
function modeAvailabilityNote(access: UsageCheck): string | null {
  if (access.limit === null) return null;
  if (access.limit === 0) return "Not included in your plan";
  return `${access.remaining ?? 0} of ${access.limit} left this month`;
}

export function InterviewSetupForm({
  cvs,
  modeAccess,
  voiceTopupsAllowed,
  repractice,
}: {
  cvs: CvListItem[];
  modeAccess: Record<InterviewMode, UsageCheck>;
  /** Elite's `voice_topups_allowed` feature flag (src/lib/entitlements/types.ts) — whether a "buy more" purchase entry point should show at all when voice is exhausted, as opposed to only an upgrade link. */
  voiceTopupsAllowed: boolean;
  /** Set by the results page's "Practice weak areas" flow — pre-fills company/role from the earlier session and restricts this new session's questions to the competencies that scored low there. The earlier session itself is never touched. */
  repractice?: InterviewRepractice | null;
}) {
  const router = useRouter();
  const eligibleCvs = cvs.filter((cv) => !cv.isArchived && cv.currentVersionId);

  const firstAvailableMode = INTERVIEW_MODES.find((mode) => modeAccess[mode].allowed) ?? INTERVIEW_MODES[0];

  const [cvId, setCvId] = useState(eligibleCvs[0]?.id ?? "");
  const [company, setCompany] = useState(repractice?.company ?? "");
  const [role, setRole] = useState(repractice?.role ?? "");
  const [jobDescription, setJobDescription] = useState("");
  const [mode, setMode] = useState<InterviewMode>(firstAvailableMode);
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("medium");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voiceAccess = modeAccess.voice;
  const voiceExhausted = voiceAccess.limit !== null && voiceAccess.limit > 0 && (voiceAccess.remaining ?? 0) <= 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!cvId) {
      setError("Choose a CV first.");
      return;
    }
    if (!modeAccess[mode].allowed) {
      setError("That interview type isn't available right now — choose another.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    setLoading(true);
    const response = await createInterviewSession(formData);

    if ("error" in response) {
      setLoading(false);
      setError(response.error);
      return;
    }
    router.push(`/dashboard/interview/${response.sessionId}`);
  }

  if (eligibleCvs.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">You need a CV with some content before starting a mock interview.</p>
        <Button className="mt-4" render={<Link href="/dashboard/cvs">Go to My CVs</Link>} />
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {repractice && repractice.focusCompetencies.length > 0 && (
          <>
            <input type="hidden" name="focusCompetencies" value={JSON.stringify(repractice.focusCompetencies)} />
            <input type="hidden" name="practicedFromSessionId" value={repractice.fromSessionId} />
            <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Focusing on:{" "}
              <span className="font-medium text-foreground">
                {repractice.focusCompetencies.map((competency) => INTERVIEW_COMPETENCY_LABELS[competency]).join(", ")}
              </span>{" "}
              — every question in this session will target one of these. Your earlier session isn&apos;t affected.
            </p>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="interview-cv">CV</Label>
          <Select
            name="cvId"
            value={cvId}
            items={Object.fromEntries(eligibleCvs.map((cv) => [cv.id, cv.title]))}
            onValueChange={(value) => setCvId(value ?? "")}
          >
            <SelectTrigger id="interview-cv" className="w-full">
              <SelectValue placeholder="Choose a CV" />
            </SelectTrigger>
            <SelectContent>
              {eligibleCvs.map((cv) => (
                <SelectItem key={cv.id} value={cv.id}>
                  {cv.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Questions are tailored against this CV&apos;s real content — nothing is invented.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="interview-company">Company</Label>
            <Input
              id="interview-company"
              name="company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="interview-role">Role</Label>
            <Input
              id="interview-role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              maxLength={200}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="interview-job-description">Job description (optional)</Label>
          <Textarea
            id="interview-job-description"
            name="jobDescription"
            rows={6}
            maxLength={20000}
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the job listing to ground questions in its real requirements — optional."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="interview-mode">Interview type</Label>
            <Select name="mode" value={mode} items={INTERVIEW_MODE_LABELS} onValueChange={(value) => value && setMode(value as InterviewMode)}>
              <SelectTrigger id="interview-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVIEW_MODES.map((option) => (
                  <SelectItem key={option} value={option} disabled={!modeAccess[option].allowed}>
                    {INTERVIEW_MODE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {INTERVIEW_MODES.map((option) => {
                const note = modeAvailabilityNote(modeAccess[option]);
                return note ? (
                  <p key={option}>
                    {INTERVIEW_MODE_LABELS[option]}: {note}
                  </p>
                ) : null;
              })}
            </div>
            {voiceExhausted && voiceTopupsAllowed && (
              <BillingActionButton
                action={purchaseVoiceTopup.bind(null, "/dashboard/interview/new")}
                label={`Buy ${VOICE_TOPUP_CREDITS} more voice interviews`}
                pendingLabel="Starting checkout…"
              />
            )}
            {voiceExhausted && !voiceTopupsAllowed && (
              <p className="text-xs text-muted-foreground">
                <Link href="/pricing" className="underline">
                  Upgrade to Elite
                </Link>{" "}
                for more voice interviews this month.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="interview-difficulty">Difficulty</Label>
            <Select
              name="difficulty"
              value={difficulty}
              items={INTERVIEW_DIFFICULTY_LABELS}
              onValueChange={(value) => value && setDifficulty(value as InterviewDifficulty)}
            >
              <SelectTrigger id="interview-difficulty" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVIEW_DIFFICULTIES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {INTERVIEW_DIFFICULTY_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={loading || !modeAccess[mode].allowed}>
          {loading ? (
            <>
              <Loader2Icon className="animate-spin" /> Setting up…
            </>
          ) : (
            "Start interview"
          )}
        </Button>
      </form>
    </Card>
  );
}
