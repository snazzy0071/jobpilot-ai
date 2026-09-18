import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { AcceptInviteCard } from "@/components/institutions/accept-invite-card";

export const dynamic = "force-dynamic";

// A per-invite, single-use functional page (like the newsletter
// unsubscribe token page) — zero search value, and there's no reason a
// specific invite link should ever end up indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function InstitutionInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();

  if (!user) {
    const redirectPath = `/institution-invite/${encodeURIComponent(token)}`;
    return (
      <Card>
        {/* sr-only real <h1> — see src/app/(auth)/login/page.tsx's own comment. */}
        <h1 className="sr-only">Join your institution</h1>
        <CardHeader>
          <CardTitle>Join your institution</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">Sign in or create an account to accept this invite.</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Button render={<Link href={`/login?redirect=${encodeURIComponent(redirectPath)}`}>Sign in</Link>} />
            <Button variant="outline" render={<Link href="/signup">Create an account</Link>} />
          </div>
          <p className="text-xs text-muted-foreground">After creating your account, come back to this link to accept your invite.</p>
        </CardContent>
      </Card>
    );
  }

  return <AcceptInviteCard token={token} />;
}
