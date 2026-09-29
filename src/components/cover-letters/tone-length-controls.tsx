"use client";

import { useState, useTransition } from "react";
import { saveVersionSettings } from "@/lib/cover-letters/paragraph-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  COVER_LETTER_TONES,
  COVER_LETTER_TONE_LABELS,
  COVER_LETTER_LENGTHS,
  COVER_LETTER_LENGTH_LABELS,
  type CoverLetterTone,
  type CoverLetterLength,
} from "@/lib/cover-letters/types";

/** Applies to future paragraph regenerations (rewrite-actions.ts reads the version's current tone at call time), not existing hand-edited text — changing these never rewrites anything on its own. */
export function ToneLengthControls({
  versionId,
  tone: initialTone,
  length: initialLength,
}: {
  versionId: string;
  tone: CoverLetterTone;
  length: CoverLetterLength;
}) {
  const [tone, setTone] = useState(initialTone);
  const [length, setLength] = useState(initialLength);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(nextTone: CoverLetterTone, nextLength: CoverLetterLength) {
    const formData = new FormData();
    formData.set("versionId", versionId);
    formData.set("tone", nextTone);
    formData.set("length", nextLength);
    startTransition(async () => {
      const result = await saveVersionSettings(undefined, formData);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cover-letter-tone-control">Tone</Label>
        <Select
          items={COVER_LETTER_TONE_LABELS}
          value={tone}
          onValueChange={(value) => {
            if (!value) return;
            const next = value as CoverLetterTone;
            setTone(next);
            save(next, length);
          }}
        >
          <SelectTrigger id="cover-letter-tone-control" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COVER_LETTER_TONES.map((option) => (
              <SelectItem key={option} value={option}>
                {COVER_LETTER_TONE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cover-letter-length-control">Length</Label>
        <Select
          items={COVER_LETTER_LENGTH_LABELS}
          value={length}
          onValueChange={(value) => {
            if (!value) return;
            const next = value as CoverLetterLength;
            setLength(next);
            save(tone, next);
          }}
        >
          <SelectTrigger id="cover-letter-length-control" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COVER_LETTER_LENGTHS.map((option) => (
              <SelectItem key={option} value={option}>
                {COVER_LETTER_LENGTH_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pending && <span className="pb-2 text-xs text-muted-foreground">Saving…</span>}
      {error && <span className="pb-2 text-xs text-destructive">{error}</span>}

      <p className="basis-full text-xs text-muted-foreground">
        Applies to future paragraph regenerations, not text you&apos;ve already written.
      </p>
    </div>
  );
}
