import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/marketing/section";
import { getQuickScanResultByToken } from "@/lib/quick-scan/results";
import { scoreTone } from "@/lib/quick-scan/score-tone";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your ATS scan result",
  robots: { index: false, follow: false },
};

// Reopens a Quick Scan result saved behind an unguessable token
// (src/lib/quick-scan/results.ts) — same reduced view the scan showed
// immediately, so a bookmarked or shared link renders the identical
// result rather than a second, different-looking summary.
export default async function QuickScanResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getQuickScanResultByToken(token);
  if (!result) notFound();

  return (
    <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-24 sm:pt-32">
      <Card className="mx-auto w-full max-w-xl p-8">
        <div className="flex flex-col gap-4">
          {/* Real <h1> — this page previously had zero headings at any
              level; the score itself is still the same plain <span>
              right below, just now with a real heading above it. */}
          <h1 className="sr-only">Your ATS scan result</h1>
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

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              render={
                <a href={`/api/quick-scan/${token}/pdf`}>
                  <DownloadIcon /> Download PDF
                </a>
              }
            />
            <Button variant="outline" size="sm" render={<Link href="/free-ats-checker">Run a new scan</Link>} />
          </div>
        </div>
      </Card>
    </Section>
  );
}
