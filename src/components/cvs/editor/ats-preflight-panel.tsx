"use client";

import { useState } from "react";
import { Loader2Icon, AlertCircleIcon, CheckCircle2Icon, LinkIcon, SparklesIcon, PlusIcon } from "lucide-react";
import { useCvPreview } from "@/components/cvs/editor/preview-context";
import { jumpToSection } from "@/components/cvs/editor/jump-to-section";
import { callAction } from "@/components/cvs/editor/call-action";
import { computeFormatIssues, buildCvPlainText } from "@/lib/cvs/ats-format-checks";
import {
  buildAtsRecommendations,
  groupAtsRecommendations,
  RECOMMENDATION_GROUP_LABELS,
  type AtsRecommendation,
} from "@/lib/cvs/ats-recommendations";
import { runAtsScan } from "@/lib/cvs/ats-actions";
import { fetchJobDescriptionFromUrl } from "@/lib/cvs/job-url-actions";
import { saveSummary, saveExperience, saveSkill } from "@/lib/cvs/section-actions";
import { rewriteSummaryForKeyword, rewriteExperienceForKeyword } from "@/lib/cvs/keyword-rewrite-actions";
import { resolveAtsRewrite } from "@/lib/cvs/ai-actions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SECTION_LABELS } from "@/lib/cvs/types";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import type {
  CvAtsScan,
  CvAtsJobOption,
  CvAtsFixPriority,
  CvSkill,
  CvProject,
  CvCertification,
  CvLanguage,
  CvCustomSection,
  SectionKey,
} from "@/lib/cvs/types";

/** A keyword-rewrite/add action currently open for one recommendation row — at most one at a time. */
type KeywordActionState = {
  recommendationId: string;
  loading: boolean;
  error: string | null;
  result: { applied: boolean; original: string; suggestion: string; explanation: string; rewriteId: string | null } | null;
};

const MIN_JOB_DESCRIPTION_LENGTH = 30;

/** DOM id the editor header's "ATS scan" button scrolls to (reference/auth/create-cv.png's toolbar button). */
export const atsPanelAnchorId = "cv-ats-panel";

function scoreTone(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

const PRIORITY_BADGE_VARIANT: Record<CvAtsFixPriority, "destructive" | "outline" | "secondary"> = {
  high: "destructive",
  medium: "outline",
  low: "secondary",
};

/**
 * Embedded ATS pre-flight — a job description, a real AI match score +
 * keyword gaps (src/lib/cvs/ats-actions.ts), and a deterministic,
 * always-live content check (src/lib/cvs/ats-format-checks.ts), with
 * "Fix in [section]" links that expand and scroll to the affected
 * accordion item (jump-to-section.ts). Reads personal/summary/
 * experience/education from useCvPreview() — the same live-typing merge
 * the preview panel renders from — so "re-score after edits" reflects
 * what's on screen right now: the deterministic half recomputes on every
 * render for free, and a fresh AI scan sends exactly that current
 * content, not a stale last-saved copy.
 */
export function AtsPreflightPanel({
  versionId,
  sectionOrder,
  skills,
  projects,
  certifications,
  languages,
  customSections,
  initialScan,
  recentJobOptions,
}: {
  versionId: string;
  sectionOrder: SectionKey[];
  skills: CvSkill[];
  projects: CvProject[];
  certifications: CvCertification[];
  languages: CvLanguage[];
  customSections: CvCustomSection[];
  initialScan: CvAtsScan | null;
  recentJobOptions: CvAtsJobOption[];
}) {
  const { preview, setLiveSummary, setLiveExperience } = useCvPreview();
  const [jobDescription, setJobDescription] = useState(initialScan?.jobDescription ?? "");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [scan, setScan] = useState<CvAtsScan | null>(initialScan);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [keywordAction, setKeywordAction] = useState<KeywordActionState | null>(null);

  const [inputMode, setInputMode] = useState<"paste" | "url">("paste");
  const [jobUrl, setJobUrl] = useState("");
  const [urlFetchLoading, setUrlFetchLoading] = useState(false);
  const [urlFetchNote, setUrlFetchNote] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const templateData: CvTemplateContentData = {
    personal: preview.personal,
    summary: preview.summary,
    experience: preview.experience,
    education: preview.education,
    skills,
    projects,
    certifications,
    languages,
    customSections,
    sectionOrder,
  };

  const formatIssues = computeFormatIssues(templateData);
  const recommendationBuckets = groupAtsRecommendations(buildAtsRecommendations(formatIssues, scan));

  function handleSelectJob(id: string | null) {
    setSelectedJobId(id ?? "");
    const option = recentJobOptions.find((row) => row.id === id);
    if (option) {
      setJobDescription(option.jobDescription);
      setInputMode("paste");
    }
  }

  async function handleFetchUrl() {
    setUrlFetchNote(null);
    const url = jobUrl.trim();
    if (!url) {
      setUrlFetchNote({ tone: "error", message: "Paste a link first." });
      return;
    }

    setUrlFetchLoading(true);
    const result = await fetchJobDescriptionFromUrl({ url });
    setUrlFetchLoading(false);

    // "blocked" covers every failure reason (SSRF-blocked, timeout,
    // non-HTML, too little extractable text, rate-limited) — all of them
    // mean the same thing here: fall back to manual paste rather than a
    // dead end.
    if ("error" in result) {
      setUrlFetchNote({ tone: "error", message: result.error });
      setInputMode("paste");
      return;
    }

    setJobDescription(result.jobDescription);
    setSelectedJobId("");
    const label = [result.title, result.company].filter(Boolean).join(" at ");
    setUrlFetchNote({
      tone: "success",
      message: label ? `Imported "${label}" — review it below before scanning.` : "Imported the job description below — review it before scanning.",
    });
    setInputMode("paste");
  }

  async function handleScan() {
    setError(null);
    const description = jobDescription.trim();
    if (description.length < MIN_JOB_DESCRIPTION_LENGTH) {
      setError("Paste the full job description first.");
      return;
    }
    const cvText = buildCvPlainText(templateData);
    if (!cvText) {
      setError("Add some CV content before scanning.");
      return;
    }

    setLoading(true);
    const result = await callAction(() =>
      runAtsScan({
        versionId,
        jobDescription: description,
        cvText,
        formatIssues,
        reusedFromScanId: selectedJobId || undefined,
      }),
    );
    setLoading(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setScan(result.scan);
  }

  /**
   * "Accepting a rewrite updates the CV then recalculates the scan" —
   * re-runs the exact same scan call handleScan does, but against a
   * *locally patched* snapshot of the current content, not whatever
   * `templateData`/props happen to hold on the next render. `saveSummary`/
   * `saveExperience` persist through `setLiveSummary`/`setLiveExperience`
   * fast enough that `preview` is already correct by the next render —
   * but `skills` is a plain server-fetched prop with no live-typing
   * overlay, so it can't be trusted to reflect a save that only just
   * started; passing the patched snapshot directly is what keeps the
   * recalculated score honest regardless of that timing.
   */
  async function recalculateScan(updatedData: CvTemplateContentData) {
    if (!scan) return;
    const cvText = buildCvPlainText(updatedData);
    setError(null);
    setLoading(true);
    const result = await callAction(() =>
      runAtsScan({
        versionId,
        jobDescription: scan.jobDescription,
        cvText,
        formatIssues: computeFormatIssues(updatedData),
        reusedFromScanId: scan.id,
      }),
    );
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setScan(result.scan);
  }

  /** Best-effort — a failed resolve shouldn't block the flow, it just leaves that ats_rewrites row as 'suggested'. */
  function resolveKeywordRewriteInBackground(rewriteId: string | null, status: "accepted" | "rejected") {
    if (!rewriteId) return;
    void resolveAtsRewrite({ rewriteId, status }).catch(() => {});
  }

  /**
   * Generates a fact-safe rewrite suggestion for one missing/weak
   * keyword — Summary and Experience only (Skills doesn't need a
   * rewrite, see handleAddSkill below; Education/Format gaps keep only
   * the manual "Fix in..." jump link, since an automated rewrite isn't
   * meaningful there).
   */
  async function handleSuggestKeywordRewrite(item: AtsRecommendation) {
    if (!item.keywordTerm) return;
    setKeywordAction({ recommendationId: item.id, loading: true, error: null, result: null });

    if (item.group === "summary") {
      const currentSummary = preview.summary?.content ?? "";
      const response = await rewriteSummaryForKeyword({ versionId, keyword: item.keywordTerm, currentSummary });
      if ("error" in response) {
        setKeywordAction({ recommendationId: item.id, loading: false, error: response.error, result: null });
        return;
      }
      setKeywordAction({
        recommendationId: item.id,
        loading: false,
        error: null,
        result: { ...response, original: currentSummary },
      });
      return;
    }

    if (item.group === "experience") {
      const role = preview.experience[0];
      if (!role) {
        setKeywordAction({ recommendationId: item.id, loading: false, error: "Add a role first.", result: null });
        return;
      }
      const currentDescription = role.description ?? "";
      const response = await rewriteExperienceForKeyword({
        versionId,
        keyword: item.keywordTerm,
        experienceId: role.id,
        jobTitle: role.jobTitle,
        currentDescription,
      });
      if ("error" in response) {
        setKeywordAction({ recommendationId: item.id, loading: false, error: response.error, result: null });
        return;
      }
      setKeywordAction({
        recommendationId: item.id,
        loading: false,
        error: null,
        result: { ...response, original: currentDescription },
      });
    }
  }

  function handleDismissKeywordAction() {
    if (keywordAction?.result) resolveKeywordRewriteInBackground(keywordAction.result.rewriteId, "rejected");
    setKeywordAction(null);
  }

  async function handleAcceptKeywordRewrite(item: AtsRecommendation) {
    if (!keywordAction || keywordAction.recommendationId !== item.id || !keywordAction.result) return;
    const { suggestion, rewriteId } = keywordAction.result;
    setKeywordAction({ ...keywordAction, loading: true });

    let updatedData: CvTemplateContentData = templateData;

    if (item.group === "summary") {
      const formData = new FormData();
      formData.set("versionId", versionId);
      formData.set("content", suggestion);
      const saveResult = await callAction(() => saveSummary(undefined, formData));
      if (saveResult && "error" in saveResult) {
        setKeywordAction({ ...keywordAction, loading: false, error: saveResult.error });
        return;
      }
      setLiveSummary(suggestion);
      updatedData = { ...templateData, summary: { id: preview.summary?.id ?? "draft", content: suggestion } };
    } else if (item.group === "experience") {
      const role = preview.experience[0];
      if (!role) return;
      const formData = new FormData();
      formData.set("versionId", versionId);
      formData.set("id", role.id);
      formData.set("jobTitle", role.jobTitle);
      formData.set("employer", role.employer);
      formData.set("location", role.location ?? "");
      formData.set("startDate", role.startDate);
      if (role.endDate) formData.set("endDate", role.endDate);
      formData.set("isCurrent", role.isCurrent ? "on" : "off");
      formData.set("description", suggestion);
      const saveResult = await callAction(() => saveExperience(undefined, formData));
      if (saveResult && "error" in saveResult) {
        setKeywordAction({ ...keywordAction, loading: false, error: saveResult.error });
        return;
      }
      setLiveExperience(role.id, { description: suggestion });
      updatedData = {
        ...templateData,
        experience: templateData.experience.map((row) => (row.id === role.id ? { ...row, description: suggestion } : row)),
      };
    }

    resolveKeywordRewriteInBackground(rewriteId, "accepted");
    setKeywordAction(null);
    await recalculateScan(updatedData);
  }

  /** Skills need no AI rewrite — a keyword gap there is just a missing list entry, added directly. */
  async function handleAddSkill(item: AtsRecommendation) {
    if (!item.keywordTerm) return;
    setKeywordAction({ recommendationId: item.id, loading: true, error: null, result: null });

    const formData = new FormData();
    formData.set("versionId", versionId);
    formData.set("name", item.keywordTerm);
    const saveResult = await callAction(() => saveSkill(undefined, formData));
    if (saveResult && "error" in saveResult) {
      setKeywordAction({ recommendationId: item.id, loading: false, error: saveResult.error, result: null });
      return;
    }

    const newSkill: CvSkill = {
      id: `pending-${item.keywordTerm}`,
      name: item.keywordTerm,
      category: null,
      displayOrder: templateData.skills.length,
      isVisible: true,
    };
    const updatedData: CvTemplateContentData = { ...templateData, skills: [...templateData.skills, newSkill] };

    setKeywordAction(null);
    await recalculateScan(updatedData);
  }

  return (
    <Card id={atsPanelAnchorId}>
      <CardHeader>
        <CardTitle>ATS pre-flight check</CardTitle>
        <CardDescription>
          Paste a job description to see your match score, keyword gaps, and content issues before you apply.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {recentJobOptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Use a previous job description</Label>
              <Select value={selectedJobId} onValueChange={handleSelectJob}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a job you've scanned before" />
                </SelectTrigger>
                <SelectContent>
                  {recentJobOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.jobDescription.slice(0, 60).replace(/\s+/g, " ")}
                      {option.jobDescription.length > 60 ? "…" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as "paste" | "url")}>
            <TabsList>
              <TabsTrigger value="paste">Paste text</TabsTrigger>
              <TabsTrigger value="url">From a link</TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="flex flex-col gap-2 pt-2">
              <Label htmlFor="ats-job-description">
                {recentJobOptions.length > 0 ? "Or paste a job description" : "Paste a job description"}
              </Label>
              <Textarea
                id="ats-job-description"
                rows={6}
                maxLength={20000}
                value={jobDescription}
                onChange={(event) => {
                  setJobDescription(event.target.value);
                  setSelectedJobId("");
                  setUrlFetchNote(null);
                }}
                placeholder="Paste the full job listing here..."
              />
            </TabsContent>

            <TabsContent value="url" className="flex flex-col gap-2 pt-2">
              <Label htmlFor="ats-job-url">Job posting link</Label>
              <div className="flex gap-2">
                <Input
                  id="ats-job-url"
                  type="url"
                  value={jobUrl}
                  onChange={(event) => setJobUrl(event.target.value)}
                  placeholder="https://company.com/careers/marketing-manager"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={handleFetchUrl} disabled={urlFetchLoading}>
                  {urlFetchLoading ? <Loader2Icon className="animate-spin" /> : <LinkIcon />}
                  Fetch
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                We&apos;ll try to pull the job description straight from the page — you&apos;ll be able to review and
                edit it before scanning. If a site blocks this, paste the text instead.
              </p>
            </TabsContent>
          </Tabs>

          {urlFetchNote && (
            <p
              className={`flex items-center gap-1.5 text-sm ${urlFetchNote.tone === "error" ? "text-destructive" : "text-success"}`}
              role={urlFetchNote.tone === "error" ? "alert" : "status"}
            >
              {urlFetchNote.tone === "error" ? (
                <AlertCircleIcon className="size-4 shrink-0" />
              ) : (
                <CheckCircle2Icon className="size-4 shrink-0" />
              )}
              {urlFetchNote.message}
            </p>
          )}

          <Button type="button" onClick={handleScan} disabled={loading} className="self-start">
            {loading ? (
              <>
                <Loader2Icon className="animate-spin" /> Scanning…
              </>
            ) : scan ? (
              "Re-score"
            ) : (
              "Run ATS scan"
            )}
          </Button>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
              <AlertCircleIcon className="size-4" /> {error}
            </p>
          )}
        </div>

        {scan && (
          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-semibold ${scoreTone(scan.overallScore)}`}>{scan.overallScore}</span>
              <span className="text-sm text-muted-foreground">/ 100 overall match with this job description</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
              <span>
                Keyword <span className={`block font-medium ${scoreTone(scan.keywordScore)}`}>{scan.keywordScore}</span>
              </span>
              <span>
                Structure <span className={`block font-medium ${scoreTone(scan.structureScore)}`}>{scan.structureScore}</span>
              </span>
              <span>
                Format <span className={`block font-medium ${scoreTone(scan.formatScore)}`}>{scan.formatScore}</span>
              </span>
              <span>
                Sections <span className={`block font-medium ${scoreTone(scan.sectionsScore)}`}>{scan.sectionsScore}</span>
              </span>
            </div>
            <p className="text-sm">{scan.summary}</p>

            {scan.matchedKeywords.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Matched keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {scan.matchedKeywords.map((keyword) => (
                    <Badge
                      key={keyword.term}
                      variant="secondary"
                      className={`gap-1 text-success ${keyword.importance === "high" ? "font-semibold" : ""}`}
                    >
                      {keyword.term}
                      {keyword.occurrenceCount > 0 && (
                        <span className="text-success/70">×{keyword.occurrenceCount}</span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {scan.strengths.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Strengths</p>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {scan.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <p className="text-xs font-medium text-muted-foreground">
            Recommendations{" "}
            {recommendationBuckets.length > 0 &&
              `(${recommendationBuckets.reduce((total, bucket) => total + bucket.items.length, 0)})`}
          </p>

          {recommendationBuckets.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2Icon className="size-4" /> No issues found — nice work.
            </p>
          ) : (
            recommendationBuckets.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {RECOMMENDATION_GROUP_LABELS[group]} ({items.length})
                </p>
                <ul className="flex flex-col gap-2">
                  {items.map((item) => {
                    const canSuggestRewrite = item.keywordTerm !== null && (item.group === "summary" || item.group === "experience");
                    const canAddSkill = item.keywordTerm !== null && item.group === "skills";
                    const isActionOpen = keywordAction?.recommendationId === item.id;

                    return (
                      <li key={item.id} className="flex flex-col gap-2 rounded-lg border p-2.5 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex items-start gap-2">
                            <Badge variant={PRIORITY_BADGE_VARIANT[item.priority]} className="mt-0.5 shrink-0 capitalize">
                              {item.priority}
                            </Badge>
                            {item.message}
                          </span>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            {canSuggestRewrite && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isActionOpen && keywordAction?.loading}
                                onClick={() => handleSuggestKeywordRewrite(item)}
                              >
                                {isActionOpen && keywordAction?.loading ? (
                                  <Loader2Icon className="animate-spin" />
                                ) : (
                                  <SparklesIcon />
                                )}
                                Suggest rewrite
                              </Button>
                            )}
                            {canAddSkill && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isActionOpen && keywordAction?.loading}
                                onClick={() => handleAddSkill(item)}
                              >
                                {isActionOpen && keywordAction?.loading ? (
                                  <Loader2Icon className="animate-spin" />
                                ) : (
                                  <PlusIcon />
                                )}
                                Add to Skills
                              </Button>
                            )}
                            {item.jumpSectionKey && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => jumpToSection(item.jumpSectionKey!)}
                              >
                                Fix in {SECTION_LABELS[item.jumpSectionKey]}
                              </Button>
                            )}
                          </div>
                        </div>

                        {isActionOpen && keywordAction?.error && (
                          <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                            <AlertCircleIcon className="size-3.5 shrink-0" /> {keywordAction.error}
                          </p>
                        )}

                        {isActionOpen && keywordAction?.result && (
                          <div className="flex flex-col gap-2 rounded-md bg-muted/30 p-2.5">
                            {!keywordAction.result.applied && (
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <AlertCircleIcon className="size-3.5 shrink-0" />
                                Couldn&apos;t work this in truthfully based on what&apos;s already there —{" "}
                                {keywordAction.result.explanation}
                              </p>
                            )}
                            {keywordAction.result.applied && (
                              <>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                  <div className="flex-1 rounded-md border bg-background p-2">
                                    <p className="mb-1 text-xs font-medium text-muted-foreground">Original</p>
                                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                                      {keywordAction.result.original}
                                    </p>
                                  </div>
                                  <div className="flex-1 rounded-md border border-primary/30 bg-primary/5 p-2">
                                    <p className="mb-1 text-xs font-medium text-primary">Suggestion</p>
                                    <p className="whitespace-pre-wrap text-xs">{keywordAction.result.suggestion}</p>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium">Why: </span>
                                  {keywordAction.result.explanation}
                                </p>
                              </>
                            )}
                            <div className="flex gap-2">
                              {keywordAction.result.applied && (
                                <Button type="button" size="sm" onClick={() => handleAcceptKeywordRewrite(item)}>
                                  Accept
                                </Button>
                              )}
                              <Button type="button" variant="ghost" size="sm" onClick={handleDismissKeywordAction}>
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
