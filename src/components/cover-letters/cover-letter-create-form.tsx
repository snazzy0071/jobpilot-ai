"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2Icon, AlertCircleIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateCoverLetter } from "@/lib/cover-letters/actions";
import { fetchJobDescriptionFromUrl } from "@/lib/cvs/job-url-actions";
import {
  COVER_LETTER_TONES,
  COVER_LETTER_TONE_LABELS,
  COVER_LETTER_LENGTHS,
  COVER_LETTER_LENGTH_LABELS,
} from "@/lib/cover-letters/types";
import type { CvListItem } from "@/lib/cvs/types";

export function CoverLetterCreateForm({ cvs }: { cvs: CvListItem[] }) {
  const eligibleCvs = cvs.filter((cv) => !cv.isArchived && cv.currentVersionId);

  const [cvId, setCvId] = useState(eligibleCvs[0]?.id ?? "");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState<(typeof COVER_LETTER_TONES)[number]>("formal");
  const [length, setLength] = useState<(typeof COVER_LETTER_LENGTHS)[number]>("standard");

  const [inputMode, setInputMode] = useState<"paste" | "url">("paste");
  const [jobUrl, setJobUrl] = useState("");
  const [urlFetchLoading, setUrlFetchLoading] = useState(false);
  const [urlFetchNote, setUrlFetchNote] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetchUrl() {
    setUrlFetchNote(null);
    const url = jobUrl.trim();
    if (!url) {
      setUrlFetchNote({ tone: "error", message: "Paste a link first." });
      return;
    }

    setUrlFetchLoading(true);
    const fetched = await fetchJobDescriptionFromUrl({ url });
    setUrlFetchLoading(false);

    if ("error" in fetched) {
      setUrlFetchNote({ tone: "error", message: fetched.error });
      setInputMode("paste");
      return;
    }

    setJobDescription(fetched.jobDescription);
    if (fetched.title) setJobTitle(fetched.title);
    if (fetched.company) setCompanyName(fetched.company);
    setUrlFetchNote({
      tone: "success",
      message: "Imported below — review the job description, company, and title before generating.",
    });
    setInputMode("paste");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!cvId) {
      setError("Choose a CV first.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    setLoading(true);
    // On success this never returns — generateCoverLetter redirects server-side once the letter is saved (see its
    // own doc comment), so the only response actually handled here is an error one. Stay in the loading state
    // through the redirect: the editor page is the real destination, not a second state this form renders.
    const response = await generateCoverLetter(formData);
    setLoading(false);
    setError(response.error);
  }

  if (eligibleCvs.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          You need a CV with some content before generating a cover letter.
        </p>
        <Button className="mt-4" render={<Link href="/dashboard/cvs">Go to My CVs</Link>} />
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cover-letter-cv">CV</Label>
          <Select name="cvId" items={Object.fromEntries(eligibleCvs.map((cv) => [cv.id, cv.title]))} value={cvId} onValueChange={(value) => setCvId(value ?? "")}>
            <SelectTrigger id="cover-letter-cv" className="w-full">
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
            The letter is grounded only in this CV&apos;s real content — nothing is invented.
          </p>
        </div>

        <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as "paste" | "url")}>
          <TabsList>
            <TabsTrigger value="paste">Paste text</TabsTrigger>
            <TabsTrigger value="url">From a link</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="flex flex-col gap-2 pt-2">
            <Label htmlFor="cover-letter-job-description">Job description</Label>
            <Textarea
              id="cover-letter-job-description"
              name="jobDescription"
              rows={8}
              maxLength={20000}
              value={jobDescription}
              onChange={(event) => {
                setJobDescription(event.target.value);
                setUrlFetchNote(null);
              }}
              placeholder="Paste the full job listing here..."
              required
            />
          </TabsContent>

          <TabsContent value="url" className="flex flex-col gap-2 pt-2">
            <Label htmlFor="cover-letter-job-url">Job posting link</Label>
            <div className="flex gap-2">
              <Input
                id="cover-letter-job-url"
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
              We&apos;ll try to pull the job description, company, and title straight from the page — you&apos;ll be
              able to review and edit everything before generating. If a site blocks this, paste the text instead.
            </p>
          </TabsContent>
        </Tabs>

        {urlFetchNote && (
          <p className={`text-xs ${urlFetchNote.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
            {urlFetchNote.message}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cover-letter-company">Company name</Label>
            <Input
              id="cover-letter-company"
              name="companyName"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cover-letter-title">Job title</Label>
            <Input
              id="cover-letter-title"
              name="jobTitle"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              maxLength={200}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cover-letter-tone">Tone</Label>
            <Select name="tone" items={COVER_LETTER_TONE_LABELS} value={tone} onValueChange={(value) => setTone(value as typeof tone)}>
              <SelectTrigger id="cover-letter-tone" className="w-full">
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
            <Label htmlFor="cover-letter-length">Length</Label>
            <Select name="length" items={COVER_LETTER_LENGTH_LABELS} value={length} onValueChange={(value) => setLength(value as typeof length)}>
              <SelectTrigger id="cover-letter-length" className="w-full">
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
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}

        <Button type="submit" variant="gradient" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2Icon className="animate-spin" /> Generating…
            </>
          ) : (
            "Generate cover letter"
          )}
        </Button>
      </form>
    </Card>
  );
}
