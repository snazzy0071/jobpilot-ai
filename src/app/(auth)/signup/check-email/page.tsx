import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";

// A pure post-submit transitional screen (reachable only right after
// signing up) — zero standalone search value, same reasoning as
// /signup/verified (already disallowed in robots.txt). Kept crawlable
// (no robots.txt entry) rather than disallowed so Google can actually
// see and honour this tag, per Google's own guidance on the two not
// being interchangeable.
export const metadata: Metadata = { title: "Check your inbox", robots: { index: false, follow: false } };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <Card>
      {/* sr-only real <h1> — see src/app/(auth)/login/page.tsx's own comment. */}
      <h1 className="sr-only">Check your inbox</h1>
      <CardHeader>
        <CardTitle>Check your inbox</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a confirmation link{email ? ` to ${email}` : ""}. Click it to
          activate your account.
        </p>
        {email && <ResendConfirmationForm email={email} />}
      </CardContent>
    </Card>
  );
}
