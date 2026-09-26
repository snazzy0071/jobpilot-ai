import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PreparationSummary } from "@/components/graduate-schemes/preparation/preparation-summary";
import { getEffectiveUser } from "@/lib/auth/session";
import { schemeSignupPath } from "@/lib/graduate-schemes/signup-context";
import { getPreparationState } from "@/lib/graduate-schemes/preparation/queries";
import type { GraduateScheme } from "@/lib/graduate-schemes/types";

/**
 * On the public scheme page: for a signed-in user, their live preparation; for a visitor, an invitation to sign in.
 * A failure to load the user's progress says so instead of pretending they have none.
 */
export async function PreparationPanel({ scheme }: { scheme: GraduateScheme }) {
  const user = await getEffectiveUser();
  const prepareHref = `/dashboard/graduate-schemes/${scheme.slug}/prepare`;

  if (!user) {
    return (
      <Card className="gap-3 p-5" data-testid="preparation-signin">
        <h2 className="font-heading text-lg font-semibold">Prepare your application</h2>
        <p className="text-sm text-muted-foreground">
          Get your CV ready, check it against this scheme, practise the tests it uses, rehearse the interview and track the application — with your progress saved for this scheme.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href={`/login?redirect=${encodeURIComponent(prepareHref)}`}>Sign in to prepare</Link>} />
          <Button variant="outline" render={<Link href={schemeSignupPath(scheme.slug)}>Create a free account</Link>} />
        </div>
      </Card>
    );
  }

  let state;
  try {
    state = await getPreparationState(user.id, scheme);
  } catch (error) {
    console.error("PreparationPanel failed:", error);
    return (
      <Card className="p-5 text-sm text-destructive" role="alert" data-testid="preparation-error">
        We couldn&apos;t load your preparation for this scheme just now — try refreshing.
      </Card>
    );
  }
  return <PreparationSummary scheme={scheme} state={state} prepareHref={prepareHref} />;
}
