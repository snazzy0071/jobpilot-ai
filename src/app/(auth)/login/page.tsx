import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoginForm } from "@/components/auth/login-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { parseRedirectParam } from "@/lib/auth/safe-redirect";
import { buildMetadata } from "@/lib/seo/metadata";

// Was falling back to the root layout's generic default title/description
// for every (auth) page (login, signup, forgot-password all showing the
// exact same "JobPilot AI" title in search results) — a real, unique one
// here since this is a genuinely indexable, publicly-searched page
// (unlike /dashboard etc., logged-out visitors are exactly who this is for).
export const metadata = buildMetadata({
  title: "Sign in",
  description: "Sign in to your JobPilot AI account to keep building your CV, tracking applications, and prepping for interviews.",
  path: "/login",
});

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const redirectParam = searchParams.redirect;
  // No default substituted here (unlike toSafeRedirectPath) — an absent
  // ?redirect= means "no explicit destination was requested", which
  // must stay distinguishable from one, so the post-login action can
  // fall back to the signed-in user's own role home instead of always
  // /dashboard. LoginForm/OAuthButtons already treat a falsy redirectTo
  // as "omit it" rather than "explicitly redirect to nothing".
  const redirectTo = parseRedirectParam(
    Array.isArray(redirectParam) ? redirectParam[0] : redirectParam,
  );
  const errorParam = searchParams.error;
  const oauthError = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  return (
    <Card>
      {/* sr-only real <h1> — CardTitle below is an <h2> by design (it's
          used inside cards everywhere, not just page-level headings),
          but this page has nothing above it, so without this a screen
          reader user gets no h1 at all. */}
      <h1 className="sr-only">Sign in</h1>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {oauthError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {oauthError}
          </p>
        )}
        <OAuthButtons redirectTo={redirectTo ?? undefined} />
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>
        <LoginForm redirectTo={redirectTo ?? undefined} />
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
