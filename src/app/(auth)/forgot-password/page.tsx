import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { buildMetadata } from "@/lib/seo/metadata";

// See src/app/(auth)/login/page.tsx's own comment. Kept indexable
// (unlike its check-email/reset-password follow-on steps below): someone
// locked out genuinely searches "[app] forgot password" for exactly this.
export const metadata = buildMetadata({
  title: "Reset your password",
  description: "Request a password reset link for your JobPilot AI account.",
  path: "/forgot-password",
});

export default function ForgotPasswordPage() {
  return (
    <Card>
      {/* sr-only real <h1> — see src/app/(auth)/login/page.tsx's own comment. */}
      <h1 className="sr-only">Reset your password</h1>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
