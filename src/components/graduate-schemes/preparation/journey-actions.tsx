"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addSchemeToTracker, chooseCvForScheme, runSchemeAtsScan, startPreparation, startSchemeInterview } from "@/lib/graduate-schemes/preparation/actions";
import { INTERVIEW_DIFFICULTIES, INTERVIEW_DIFFICULTY_LABELS, INTERVIEW_MODES, INTERVIEW_MODE_LABELS } from "@/lib/interviews/types";

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function run(action: () => Promise<{ error: string } | { ok: true }>, after?: (result: { ok: true }) => void) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      after?.(result);
      router.refresh();
    });
  }
  return { pending, error, run, router };
}

function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export function StartPreparationButton({ schemeId, label = "Prepare application" }: { schemeId: string; label?: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => run(() => startPreparation({ schemeId }))} disabled={pending} className="w-fit">
        {pending && <Loader2Icon className="animate-spin" />} {label}
      </Button>
      <ErrorLine message={error} />
    </div>
  );
}

export function CvPicker({ schemeId, cvs, currentId }: { schemeId: string; cvs: { id: string; title: string }[]; currentId: string | null }) {
  const { pending, error, run } = useAction();
  const [value, setValue] = useState(currentId ?? cvs[0]?.id ?? "");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="prep-cv">CV to prepare for this scheme</Label>
      <div className="flex flex-wrap gap-2">
        <select id="prep-cv" value={value} onChange={(e) => setValue(e.target.value)} className={`${SELECT_CLASS} max-w-sm`}>
          {cvs.map((cv) => (
            <option key={cv.id} value={cv.id}>
              {cv.title}
            </option>
          ))}
        </select>
        <Button onClick={() => run(() => chooseCvForScheme({ schemeId, cvId: value }))} disabled={pending || !value || value === currentId}>
          {pending && <Loader2Icon className="animate-spin" />} {currentId ? "Use this CV" : "Choose this CV"}
        </Button>
      </div>
      <ErrorLine message={error} />
    </div>
  );
}

export function AtsRunner({ schemeId, defaultText, hasScan }: { schemeId: string; defaultText: string; hasScan: boolean }) {
  const { pending, error, run } = useAction();
  const [text, setText] = useState(defaultText);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="prep-jd">Text to check your CV against</Label>
      <Textarea id="prep-jd" rows={7} value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} />
      <p className="text-xs text-muted-foreground">Pre-filled from the scheme&apos;s own details. For a sharper result, replace it with the employer&apos;s full posting.</p>
      <Button onClick={() => run(() => runSchemeAtsScan({ schemeId, jobDescription: text }))} disabled={pending || text.trim().length < 30} className="w-fit">
        {pending && <Loader2Icon className="animate-spin" />} {pending ? "Scanning…" : hasScan ? "Run the ATS check again" : "Run the ATS check"}
      </Button>
      <ErrorLine message={error} />
    </div>
  );
}

export function InterviewStarter({ schemeId, resumeLabel }: { schemeId: string; resumeLabel: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<string>("chat");
  const [difficulty, setDifficulty] = useState<string>("medium");

  function start() {
    setError("");
    startTransition(async () => {
      const result = await startSchemeInterview({ schemeId, mode, difficulty });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/interview/${result.sessionId}`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {!resumeLabel && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prep-mode">Interview type</Label>
            <select id="prep-mode" value={mode} onChange={(e) => setMode(e.target.value)} className={SELECT_CLASS}>
              {INTERVIEW_MODES.map((m) => (
                <option key={m} value={m}>
                  {INTERVIEW_MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prep-difficulty">Difficulty</Label>
            <select id="prep-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={SELECT_CLASS}>
              {INTERVIEW_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {INTERVIEW_DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <Button className="w-fit" disabled={pending} onClick={start}>
        {pending && <Loader2Icon className="animate-spin" />} {resumeLabel ?? "Start a mock interview"}
      </Button>
      <ErrorLine message={error} />
    </div>
  );
}

export function TrackerAdder({ schemeId }: { schemeId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => run(() => addSchemeToTracker({ schemeId }))} disabled={pending} className="w-fit">
        {pending && <Loader2Icon className="animate-spin" />} Add to my tracker
      </Button>
      <ErrorLine message={error} />
    </div>
  );
}
