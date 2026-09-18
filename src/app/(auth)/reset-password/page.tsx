import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

// See src/app/(auth)/signup/verified/page.tsx's own comment.
export const metadata: Metadata = { title: "Set a new password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage() {
  // Reachable only with the temporary session created by verifying the
  // recovery link in /auth/confirm; requireUser bounces anyone else to
  // /login rather than showing a form that can't succeed.
  await requireUser();

  return (
    <Card>
      {/* sr-only real <h1> — see src/app/(auth)/login/page.tsx's own comment. */}
      <h1 className="sr-only">Set a new password</h1>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
