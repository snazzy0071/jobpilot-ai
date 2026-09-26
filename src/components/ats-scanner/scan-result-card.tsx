import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "@/components/ats-scanner/score-ring";
import type { CvAtsScan } from "@/lib/cvs/types";

function scoreTone(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

/**
 * The result of a real scan — score ring, the five sub-scores, matched keywords, strengths. Shared by both
 * ATS Scanner entry points (a saved CV, or an uploaded/pasted one): the data underneath is the same shape
 * (`CvAtsScan`) either way, only where it came from differs, which belongs in the caller, not here.
 */
export function ScanResultCard({ scan }: { scan: CvAtsScan }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <ScoreRing score={scan.overallScore} />
          <div>
            <p className="text-sm text-muted-foreground">Overall match with this job description</p>
            <p className="text-sm">{scan.summary}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-4">
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

        <p className="border-t pt-3 text-sm text-muted-foreground">
          Keywords matched: {scan.matchedKeywords.length} of {scan.matchedKeywords.length + scan.missingKeywords.length}
        </p>

        {scan.matchedKeywords.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Matched keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {scan.matchedKeywords.map((keyword) => (
                <Badge key={keyword.term} variant="secondary" className={`gap-1 text-success ${keyword.importance === "high" ? "font-semibold" : ""}`}>
                  {keyword.term}
                  {keyword.occurrenceCount > 0 && <span className="text-success/70">×{keyword.occurrenceCount}</span>}
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
      </CardContent>
    </Card>
  );
}
