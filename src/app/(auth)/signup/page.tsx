import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SignupForm } from "@/components/auth/signup-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { buildMetadata } from "@/lib/seo/metadata";

// See src/app/(auth)/login/page.tsx's own comment.
export const metadata = buildMetadata({
  title: "Sign up",
  description: "Create a free JobPilot AI account — a UK-standard CV builder, ATS scanner, interview coach, and visa sponsor register.",
  path: "/signup",
});

export default function SignupPage() {
  return (
    <Card>
      {/* sr-only real <h1> — see src/app/(auth)/login/page.tsx's own comment. */}
      <h1 className="sr-only">Create your account</h1>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <OAuthButtons />
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>
        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
