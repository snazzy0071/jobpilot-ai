"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, AlertCircleIcon, Trash2Icon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiRewritePanel } from "@/components/cvs/editor/ai-rewrite-panel";
import { AutosaveStatus } from "@/components/cvs/editor/autosave-status";
import { useAutosave } from "@/components/cvs/editor/use-autosave";
import { VersionHistoryDialog } from "@/components/cvs/editor/version-history-dialog";
import { CopyTextButton } from "@/components/linkedin/copy-text-button";
import { regenerateLinkedinDraft, deleteLinkedinDraft } from "@/lib/linkedin/actions";
import { saveLinkedinAbout, saveLinkedinBullet, saveLinkedinHeadline, restoreLinkedinDraftVersion } from "@/lib/linkedin/edit-actions";
import {
  regenerateLinkedinAbout,
  resolveLinkedinAboutRewrite,
  regenerateLinkedinExperienceBullet,
  resolveLinkedinExperienceBulletRewrite,
} from "@/lib/linkedin/rewrite-actions";
import { computeLinkedinKeywordCoverage } from "@/lib/linkedin/keyword-coverage";
import {
  LINKEDIN_TARGET_SENIORITIES,
  LINKEDIN_TARGET_SENIORITY_LABELS,
  LINKEDIN_KEYWORD_PLACEMENTS,
  LINKEDIN_KEYWORD_PLACEMENT_LABELS,
  type LinkedinTargetSeniority,
  type LinkedinKeywordTerm,
  type LinkedinKeywordImportance,
} from "@/lib/linkedin/types";
import type { LinkedinProfileDraftDetail, LinkedinExperienceBulletItem, LinkedinDraftVersionSummary } from "@/lib/linkedin/types";

const NETWORK_ERROR_MESSAGE = "Couldn't reach the server — check your connection and try again.";

const HEADLINE_VARIANT_LABELS = { concise: "Concise", narrative: "Narrative", keywordDense: "Keyword-dense" } as const;

const IMPORTANCE_BADGE_VARIANT: Record<LinkedinKeywordImportance, "default" | "secondary" | "outline"> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

function KeywordCoverageSection({
  keywordTerms,
  before,
  after,
}: {
  keywordTerms: LinkedinKeywordTerm[];
  before: { score: number } | null;
  after: { score: number; found: LinkedinKeywordTerm[]; missing: LinkedinKeywordTerm[] };
}) {
  if (keywordTerms.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Recruiter-search keyword coverage</p>
        <p className="text-sm">
          {before && <span className="text-muted-foreground">{before.score}</span>}
          {before && " → "}
          <span className="font-semibold text-primary">{after.score}</span>
          <span className="text-muted-foreground"> / 100</span>
        </p>
      </div>

      {after.found.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Found ({after.found.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {after.found.map((keyword) => (
              <Badge key={keyword.term} variant={IMPORTANCE_BADGE_VARIANT[keyword.importance]}>
                {keyword.term}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {after.missing.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Missing ({after.missing.length})</p>
          {LINKEDIN_KEYWORD_PLACEMENTS.map((placement) => {
            const terms = after.missing.filter((keyword) => keyword.suggestedPlacement === placement);
            if (terms.length === 0) return null;
            return (
              <div key={placement} className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Add to {LINKEDIN_KEYWORD_PLACEMENT_LABELS[placement]}:</p>
                <div className="flex flex-wrap gap-1.5">
                  {terms.map((keyword) => (
                    <Badge key={keyword.term} variant={IMPORTANCE_BADGE_VARIANT[keyword.importance]}>
                      {keyword.term}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type EditResult = { error: string } | { success: string } | void;

/** A text field whose edits are saved automatically (debounced) through a real Server Action, with the same Saving/Saved/error indicator the CV editor uses. */
function AutosavedField({
  action,
  fixed,
  name,
  value,
  onValueChange,
  ariaLabel,
  multiline = true,
  rows = 3,
  maxLength,
}: {
  action: (prevState: EditResult, formData: FormData) => Promise<EditResult>;
  /** Hidden identifiers sent with every save (draftId / bulletId). */
  fixed: Record<string, string>;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  multiline?: boolean;
  rows?: number;
  maxLength: number;
}) {
  const { status, errorMessage, scheduleSave } = useAutosave(action);

  function handleChange(next: string) {
    onValueChange(next);
    const formData = new FormData();
    for (const [key, fixedValue] of Object.entries(fixed)) formData.set(key, fixedValue);
    formData.set(name, next);
    scheduleSave(formData);
  }

  return (
    <div className="flex flex-col gap-1">
      {multiline ? (
        <Textarea aria-label={ariaLabel} rows={rows} maxLength={maxLength} value={value} onChange={(event) => handleChange(event.target.value)} />
      ) : (
        <Input aria-label={ariaLabel} maxLength={maxLength} value={value} onChange={(event) => handleChange(event.target.value)} />
      )}
      <div className="flex items-center justify-between gap-2">
        <AutosaveStatus status={status} errorMessage={errorMessage} />
        <p className="ml-auto text-xs text-muted-foreground">
          {value.length} / {maxLength}
        </p>
      </div>
    </div>
  );
}

function BeforeAfter({ label, before, after, afterEditor }: { label: string; before: string; after: string; afterEditor?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <CopyTextButton content={after} label="Copy rewrite" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Before</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{before || "(nothing pasted)"}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">After</p>
          {afterEditor ?? <p className="text-sm whitespace-pre-wrap">{after}</p>}
        </div>
      </div>
    </div>
  );
}

function ExperienceBulletRow({
  bullet,
  otherBulletsText,
  onAccepted,
}: {
  bullet: LinkedinExperienceBulletItem;
  otherBulletsText: string;
  onAccepted: (bulletId: string, content: string) => void;
}) {
  const [content, setContent] = useState(bullet.content);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <AutosavedField
            action={saveLinkedinBullet}
            fixed={{ bulletId: bullet.id }}
            name="content"
            value={content}
            onValueChange={(next) => {
              setContent(next);
              onAccepted(bullet.id, next);
            }}
            ariaLabel="Experience bullet"
            rows={2}
            maxLength={300}
          />
        </div>
        <CopyTextButton content={content} label="Copy" />
      </div>
      <AiRewritePanel
        getValue={() => content}
        rewrite={(currentContent) =>
          regenerateLinkedinExperienceBullet({ bulletId: bullet.id, currentContent, otherBullets: otherBulletsText })
        }
        resolve={(rewriteId, status) => resolveLinkedinExperienceBulletRewrite({ rewriteId, status })}
        onAccept={(suggestion) => {
          setContent(suggestion);
          onAccepted(bullet.id, suggestion);
        }}
        label="Regenerate this bullet"
      />
    </div>
  );
}

/**
 * The draft's before/after (3 headline variants, About, Experience
 * bullets), recruiter-search keyword coverage (found/missing against a
 * fixed keyword list, before/after score), suggested skills/notes, and
 * a whole-draft "Edit & regenerate" section for changing the pasted
 * input itself. About and each Experience bullet reuse AiRewritePanel —
 * the same Regenerate -> Accept/Try again/Reject flow the CV editor and
 * cover letter paragraphs already use — rather than a bespoke review
 * UI. No "apply to LinkedIn" button exists anywhere here — there's no
 * LinkedIn API integration to apply through, only Copy buttons for
 * pasting the rewrite back in by hand.
 */
export function LinkedinDraftDetail({ draft, versions }: { draft: LinkedinProfileDraftDetail; versions: LinkedinDraftVersionSummary[] }) {
  const router = useRouter();

  const [about, setAbout] = useState(draft.optimizedAbout);
  const [selectedHeadline, setSelectedHeadline] = useState(draft.selectedHeadline ?? "");
  const [bullets, setBullets] = useState(draft.experienceBullets);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(draft.title);
  const [targetRole, setTargetRole] = useState(draft.targetRole);
  const [targetSeniority, setTargetSeniority] = useState<LinkedinTargetSeniority>(draft.targetSeniority);
  const [currentHeadline, setCurrentHeadline] = useState(draft.currentHeadline);
  const [currentAbout, setCurrentAbout] = useState(draft.currentAbout);
  const [currentExperience, setCurrentExperience] = useState(draft.currentExperience);

  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRegenerating(true);
    const formData = new FormData(event.currentTarget);
    let result: Awaited<ReturnType<typeof regenerateLinkedinDraft>>;
    try {
      result = await regenerateLinkedinDraft(undefined, formData);
    } catch {
      // A dropped connection rejects the Server Action call itself — without this the button stayed on
      // "Regenerating…" forever.
      setRegenerating(false);
      setError(NETWORK_ERROR_MESSAGE);
      return;
    }
    setRegenerating(false);

    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    setEditing(false);
    // The whole draft (headline variants, About, Experience bullets —
    // all new rows with new ids) changed server-side; this component's
    // own local state was seeded from the old ones, so a full refresh +
    // remount (see the `key` on this component in the page) is what
    // picks up the new data, not a manual field-by-field patch.
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm("Delete this draft? This can't be undone.")) return;
    setDeleting(true);
    const formData = new FormData();
    formData.set("draftId", draft.id);
    let result: Awaited<ReturnType<typeof deleteLinkedinDraft>>;
    try {
      result = await deleteLinkedinDraft(undefined, formData);
    } catch {
      setDeleting(false);
      setError(NETWORK_ERROR_MESSAGE);
      return;
    }
    if (result && "error" in result) {
      setDeleting(false);
      setError(result.error);
      return;
    }
    router.push("/dashboard/linkedin");
  }

  // Choosing a variant saves right away (there's no typing to debounce).
  async function saveChosenHeadline(headline: string) {
    const formData = new FormData();
    formData.set("draftId", draft.id);
    formData.set("headline", headline);
    try {
      const result = await saveLinkedinHeadline(undefined, formData);
      if (result && "error" in result) setError(result.error);
    } catch {
      setError("Couldn't reach the server, so that choice isn't saved yet — try again.");
    }
  }

  function handleBulletAccepted(bulletId: string, content: string) {
    setBullets((prev) => prev.map((bullet) => (bullet.id === bulletId ? { ...bullet, content } : bullet)));
  }

  // Recomputed on every render that changes `about`/`bullets` — the
  // moment an Accept fires, not only after a whole-draft regenerate —
  // so the "after" score never shows a number that's already gone
  // stale. Headline variants never change via Accept/Reject (no review
  // flow exists for them), so they're a constant input here, not a
  // dependency that needs tracking.
  // The headline counts only once the user has *chosen* one (a variant, or their own edit of it) — until then their
  // as-pasted headline stands. Counting all three variants would credit a keyword that only appears in a variant
  // nobody is using.
  const afterText = useMemo(() => {
    const headlineText = selectedHeadline.trim() !== "" ? selectedHeadline : draft.currentHeadline;
    return [headlineText, about ?? "", ...bullets.map((bullet) => bullet.content)].join("\n");
  }, [selectedHeadline, draft.currentHeadline, about, bullets]);

  // Newest first; the draft itself is always the current state, so it heads the list and isn't restorable.
  const historyEntries = [
    { id: "current", versionNumber: versions.length + 1, label: "Current draft", isCurrent: true, createdAt: draft.updatedAt },
    ...versions.map((version, index) => ({
      id: version.id,
      versionNumber: versions.length - index,
      label: version.label,
      isCurrent: false,
      createdAt: version.createdAt,
    })),
  ];

  const keywordCoverageAfter = useMemo(
    () => computeLinkedinKeywordCoverage(draft.keywordTerms, afterText),
    [draft.keywordTerms, afterText],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {targetRole} · {LINKEDIN_TARGET_SENIORITY_LABELS[targetSeniority]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <VersionHistoryDialog versions={historyEntries} restore={restoreLinkedinDraftVersion} containerIdField="draftId" containerId={draft.id} />
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing((value) => !value)}>
            <PencilIcon /> {editing ? "Cancel" : "Edit & regenerate all"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />} Delete
          </Button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {error}
        </p>
      )}

      {editing ? (
        <Card className="p-8">
          <form onSubmit={handleRegenerate} className="flex flex-col gap-4">
            <input type="hidden" name="draftId" value={draft.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-title">Draft name</Label>
                <Input id="edit-title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-role">Target role</Label>
                <Input
                  id="edit-role"
                  name="targetRole"
                  value={targetRole}
                  onChange={(event) => setTargetRole(event.target.value)}
                  maxLength={200}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-seniority">Target seniority</Label>
              <Select
                name="targetSeniority"
                value={targetSeniority}
                items={LINKEDIN_TARGET_SENIORITY_LABELS}
                onValueChange={(value) => value && setTargetSeniority(value as LinkedinTargetSeniority)}
              >
                <SelectTrigger id="edit-seniority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINKEDIN_TARGET_SENIORITIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {LINKEDIN_TARGET_SENIORITY_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-headline">Current headline (optional)</Label>
              <Input
                id="edit-headline"
                name="currentHeadline"
                value={currentHeadline}
                onChange={(event) => setCurrentHeadline(event.target.value)}
                maxLength={220}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-about">Current About section (optional)</Label>
              <Textarea id="edit-about" name="currentAbout" rows={5} maxLength={2600} value={currentAbout} onChange={(event) => setCurrentAbout(event.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-experience">Current Experience section</Label>
              <Textarea
                id="edit-experience"
                name="currentExperience"
                rows={10}
                maxLength={8000}
                value={currentExperience}
                onChange={(event) => setCurrentExperience(event.target.value)}
                required
              />
            </div>

            <Button type="submit" variant="gradient" size="lg" disabled={regenerating}>
              {regenerating ? (
                <>
                  <Loader2Icon className="animate-spin" /> Regenerating…
                </>
              ) : (
                "Regenerate everything"
              )}
            </Button>
          </form>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {draft.optimizedHeadlineVariants && (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Headline variants</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(Object.keys(HEADLINE_VARIANT_LABELS) as Array<keyof typeof HEADLINE_VARIANT_LABELS>).map((variant) => (
                  <div key={variant} className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-medium tracking-wide text-primary uppercase">{HEADLINE_VARIANT_LABELS[variant]}</p>
                    <p className="flex-1 text-sm whitespace-pre-wrap">{draft.optimizedHeadlineVariants![variant]}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedHeadline === draft.optimizedHeadlineVariants![variant] ? "secondary" : "outline"}
                        aria-label={
                          selectedHeadline === draft.optimizedHeadlineVariants![variant]
                            ? `The ${HEADLINE_VARIANT_LABELS[variant]} headline is in use`
                            : `Use the ${HEADLINE_VARIANT_LABELS[variant]} headline`
                        }
                        onClick={() => {
                          const chosen = draft.optimizedHeadlineVariants![variant];
                          setSelectedHeadline(chosen);
                          void saveChosenHeadline(chosen);
                        }}
                      >
                        {selectedHeadline === draft.optimizedHeadlineVariants![variant] ? "In use" : "Use this headline"}
                      </Button>
                      <CopyTextButton content={draft.optimizedHeadlineVariants![variant]} label="Copy" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Your headline — choose a variant, then edit freely</p>
                <AutosavedField
                  action={saveLinkedinHeadline}
                  fixed={{ draftId: draft.id }}
                  name="headline"
                  value={selectedHeadline}
                  onValueChange={setSelectedHeadline}
                  ariaLabel="Your headline"
                  multiline={false}
                  maxLength={220}
                />
              </div>
            </div>
          )}

          <KeywordCoverageSection keywordTerms={draft.keywordTerms} before={draft.keywordCoverageBefore} after={keywordCoverageAfter} />

          {about && (
            <div className="flex flex-col gap-3">
              <BeforeAfter
                label="About"
                before={draft.currentAbout}
                after={about}
                afterEditor={
                  <AutosavedField
                    action={saveLinkedinAbout}
                    fixed={{ draftId: draft.id }}
                    name="about"
                    value={about}
                    onValueChange={setAbout}
                    ariaLabel="Your About section"
                    rows={8}
                    maxLength={2600}
                  />
                }
              />
              <AiRewritePanel
                getValue={() => about}
                rewrite={(currentAboutValue) => regenerateLinkedinAbout({ draftId: draft.id, currentAbout: currentAboutValue })}
                resolve={(rewriteId, status) => resolveLinkedinAboutRewrite({ rewriteId, status })}
                onAccept={(suggestion) => setAbout(suggestion)}
                label="Regenerate About with AI"
              />
            </div>
          )}

          {bullets.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Experience bullets</p>
                <CopyTextButton content={bullets.map((bullet) => `• ${bullet.content}`).join("\n")} label="Copy all" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Before (as pasted)</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{draft.currentExperience}</p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-wide text-primary uppercase">After — regenerate or accept each</p>
                {bullets.map((bullet) => (
                  <ExperienceBulletRow
                    key={bullet.id}
                    bullet={bullet}
                    otherBulletsText={bullets
                      .filter((other) => other.id !== bullet.id)
                      .map((other) => other.content)
                      .join("\n")}
                    onAccepted={handleBulletAccepted}
                  />
                ))}
              </div>
            </div>
          )}

          {draft.suggestedSkills.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Skills to add</p>
              <div className="flex flex-wrap gap-2">
                {draft.suggestedSkills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {draft.notes.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Other suggestions</p>
              <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                {draft.notes.map((note, index) => (
                  <li key={index}>• {note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
