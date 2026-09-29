import Link from "next/link";
import { MailIcon, PlusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listCoverLetters } from "@/lib/cover-letters/queries";
import { COVER_LETTER_TONE_LABELS, COVER_LETTER_LENGTH_LABELS } from "@/lib/cover-letters/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

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
        <Button render={<Link href="/dashboard/cover-letters/new"><PlusIcon /> New cover letter</Link>} />
      </div>

      {letters.length === 0 ? (
        <EmptyState
          icon={MailIcon}
          title="You haven't generated a cover letter yet"
          description="Pick a CV, paste or import a job description, and get a draft grounded only in what's really on your CV."
          actions={<Button render={<Link href="/dashboard/cover-letters/new"><PlusIcon /> New cover letter</Link>} />}
        />
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
