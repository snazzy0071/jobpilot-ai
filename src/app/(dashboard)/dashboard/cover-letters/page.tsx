import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listCoverLetters } from "@/lib/cover-letters/queries";
import { COVER_LETTER_TONE_LABELS, COVER_LETTER_LENGTH_LABELS } from "@/lib/cover-letters/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export default async function CoverLettersPage() {
  const user = await requireUser();
  const letters = await listCoverLetters(user.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Cover Letters</h1>
          <p className="mt-1 text-muted-foreground">Tailored drafts generated from your CV and a job description.</p>
        </div>
        <Button render={<Link href="/dashboard/cover-letters/new"><PlusIcon /> New cover letter</Link>} />
      </div>

      {letters.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">You haven&apos;t generated a cover letter yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {letters.map((letter) => (
            <Link key={letter.id} href={`/dashboard/cover-letters/${letter.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="text-base">{letter.jobTitle}</CardTitle>
                  <CardDescription>{letter.companyName}</CardDescription>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {COVER_LETTER_TONE_LABELS[letter.tone]} · {COVER_LETTER_LENGTH_LABELS[letter.length]}
                  </p>
                  <p className="text-xs text-muted-foreground">Updated {formatDate(letter.updatedAt)}</p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
