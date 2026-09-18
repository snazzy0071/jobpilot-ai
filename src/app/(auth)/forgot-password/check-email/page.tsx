import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// See src/app/(auth)/signup/check-email/page.tsx's own comment.
export const metadata: Metadata = { title: "Check your inbox", robots: { index: false, follow: false } };

export default function CheckEmailPage() {
  return (
    <Card>
      {/* sr-only real <h1> — see src/app/(auth)/login/page.tsx's own comment. */}
      <h1 className="sr-only">Check your inbox</h1>
      <CardHeader>
        <CardTitle>Check your inbox</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </p>
      </CardContent>
    </Card>
  );
}
