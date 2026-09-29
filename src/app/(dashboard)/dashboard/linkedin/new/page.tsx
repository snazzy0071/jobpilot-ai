import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkedinDraftCreateForm } from "@/components/linkedin/linkedin-draft-create-form";

export const dynamic = "force-dynamic";

export default async function NewLinkedinDraftPage() {
  const user = await requireUser();
  // The UI half of plan gating only — createLinkedinDraft/every regenerate action re-checks `linkedin_optimiser`
  // server-side through the AI gateway, so hiding the form is never the only gate.
  const entitled = await hasFeature(user.id, "linkedin_optimiser");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {entitled ? (
        <LinkedinDraftCreateForm />
      ) : (
        <Card className="flex flex-col items-start gap-3 p-8">
          <p className="font-medium">The LinkedIn Optimiser isn&apos;t included in your current plan.</p>
          <p className="text-sm text-muted-foreground">
            Upgrade to rewrite your headline, About and Experience for the role you want. Any drafts you&apos;ve already made
            stay available.
          </p>
          <Button render={<Link href="/pricing">See plans</Link>} />
        </Card>
      )}
    </div>
  );
}
