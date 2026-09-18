"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2Icon, AlertCircleIcon, DownloadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { runQuickScan, type QuickScanResult } from "@/lib/quick-scan/quick-scan-actions";
import { subscribeToNewsletter } from "@/lib/newsletter/actions";
import { scoreTone } from "@/lib/quick-scan/score-tone";

/**
 * The real backend for this page — src/lib/quick-scan/quick-scan-
 * actions.ts's runQuickScan. Results render directly on this page from
 * the action's return value *and* runQuickScan emails the same report
 * (with the PDF attached) to the address entered below — required
 * delivery of the thing the caller just asked for, unconditional on the
 * separate `marketingConsent` checkbox further down this form, which
 * only ever controls the `subscribeToNewsletter` call a few lines below
 * it. The two must stay wired to genuinely independent backends, not
 * merely independent-looking UI, or unchecking one would silently
 * affect the other.
 */
export function FreeAtsCheckerForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickScanResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const formData = new FormData(event.currentTarget);
    setLoading(true);
    const response = await runQuickScan(formData);
    setLoading(false);

    if ("error" in response) {
      setError(response.error);
      return;
    }
    setResult(response);

    if (formData.get("marketingConsent") === "on") {
      const newsletterFormData = new FormData();
      newsletterFormData.set("email", String(formData.get("email") ?? ""));
      newsletterFormData.set("source", "quick_scan");
      void subscribeToNewsletter(undefined, newsletterFormData).catch(() => {});
    }
  }

  if (result && "overallScore" in result) {
    return (
      <Card className="mx-auto w-full max-w-xl p-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-semibold ${scoreTone(result.overallScore)}`}>{result.overallScore}</span>
            <span className="text-sm text-muted-foreground">/ 100 match with this job description</span>
          </div>
          <p className="text-sm">{result.summary}</p>

          {result.matchedKeywords.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Top matched keywords ({result.matchedKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.matchedKeywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="text-success">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.missingKeywords.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Top missing keywords ({result.missingKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.missingKeywords.map((keyword) => (
                  <Badge key={keyword} variant="outline" className="text-warning">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.topFixes.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Top fixes</p>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {result.topFixes.map((fix) => (
                  <li key={fix}>{fix}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            This is the reduced, no-account view — a full score breakdown, the complete keyword and fix list, and
            AI-suggested rewrites you can apply straight to a CV are all part of a free account.
          </p>

          {result.resultToken && (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                {result.emailSent
                  ? "We've also emailed you this report as a PDF. It's"
                  : "This report couldn't be emailed to you just now, but it's"}{" "}
                saved for 90 days behind a private link — anyone with the link can view it, so don&apos;t share it
                unless you mean to.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link href={`/free-ats-checker/results/${result.resultToken}`}>Reopen this result later</Link>
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a href={`/api/quick-scan/${result.resultToken}/pdf`}>
                      <DownloadIcon /> Download PDF
                    </a>
                  }
                />
              </div>
            </div>
          )}

          <Button variant="outline" onClick={() => setResult(null)}>
            Scan another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-xl p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cvFile">Your CV</Label>
          <Input id="cvFile" name="file" type="file" accept=".pdf,.docx,.txt" required />
          <p className="text-xs text-muted-foreground">PDF, Word (.docx), or plain text, up to 10MB.</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="jobDescription">Job description</Label>
          <Textarea
            id="jobDescription"
            name="jobDescription"
            required
            rows={8}
            maxLength={20000}
            placeholder="Paste the full job listing here..."
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
          <p className="text-xs text-muted-foreground">
            We&apos;ll send your report here and use it to limit free scans to 2 per month — no account needed.
            We&apos;ll only send anything else if you tick the box below.
          </p>
        </div>

        {/* Honeypot — real users never see this (off-screen, unlabeled to
            assistive tech via aria-hidden); a bot's autofill often fills
            any field it finds. Left non-empty, the action quietly treats
            the submission as automated. */}
        <div className="absolute -left-[9999px]" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox id="marketingConsent" name="marketingConsent" value="on" className="mt-0.5" />
          <Label htmlFor="marketingConsent" className="text-sm font-normal text-muted-foreground">
            Send me occasional emails about new features and career tips. You can unsubscribe anytime.
          </Label>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2Icon className="animate-spin" /> Scanning…
            </>
          ) : (
            "Score my CV"
          )}
        </Button>
      </form>
    </Card>
  );
}
