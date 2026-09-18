import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Session-gated (requireUser below) and already in robots.txt's
// disallow list — noindex here too as the defense-in-depth backstop,
// same reasoning as the auth-gated layouts (dashboard/admin/etc.).
export const metadata: Metadata = { title: "Email verified", robots: { index: false, follow: false } };

export default async function SignupVerifiedPage() {
  // Verifying the confirmation link establishes a session, so anyone
  // landing here without one didn't come from a valid link.
  await requireUser();

  return (
    <Card>
      {/* sr-only real <h1> — see src/app/(auth)/login/page.tsx's own comment. */}
      <h1 className="sr-only">Email verified</h1>
      <CardHeader>
        <CardTitle>Email verified</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Your email is confirmed and you&apos;re signed in.
        </p>
        <Button render={<Link href="/dashboard">Continue to dashboard</Link>} />
      </CardContent>
    </Card>
  );
}
