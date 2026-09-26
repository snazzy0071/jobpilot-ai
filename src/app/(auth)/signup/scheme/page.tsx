import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SignupForm } from "@/components/auth/signup-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SchemeSignupContext } from "@/components/graduate-schemes/scheme-signup-context";
import { parseSchemeSignupParams, schemePreparePath } from "@/lib/graduate-schemes/signup-context";
import { findPublishedScheme } from "@/lib/graduate-schemes/signup-server";

// Scheme-specific signup. Visitors never see this URL: next.config.ts rewrites `/signup?from=grad&...` here, so the address bar
// stays `/signup?from=grad&scheme=<slug>` — and the ordinary `/signup` page (src/app/(auth)/signup/page.tsx) is left completely
// untouched and statically rendered, because it is the only one that has to read no request data. This page is per-request
// (it reads the query string) and carries the same card, form and OAuth buttons plus the selected scheme.
//
// Never indexed: it is a personalised variant of /signup, whose own canonical stays the plain page.
export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false, follow: false },
  alternates: { canonical: "/signup" },
};

export default async function SchemeSignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // A scheme that doesn't exist, is a draft, or a malformed parameter simply gives no context: this then renders exactly the
  // plain signup card.
  const scheme = await findPublishedScheme(parseSchemeSignupParams(await searchParams));
  const preparePath = scheme ? schemePreparePath(scheme.slug) : undefined;

  return (
    <Card>
      {/* sr-only real <h1> — see src/app/(auth)/login/page.tsx's own comment. */}
      <h1 className="sr-only">Create your account</h1>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {scheme && <SchemeSignupContext scheme={scheme} />}
        <OAuthButtons redirectTo={preparePath} schemeSlug={scheme?.slug} />
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>
        <SignupForm schemeSlug={scheme?.slug} />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={preparePath ? `/login?redirect=${encodeURIComponent(preparePath)}` : "/login"} className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
