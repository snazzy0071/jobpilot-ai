"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptInstitutionInvite } from "@/lib/institutions/enrollment/actions";

/**
 * The invitation-link enrollment path (migration 0072/0073) — the raw
 * token from the URL is only ever sent to acceptInstitutionInvite,
 * which hashes it server-side before comparing; this component never
 * sees or needs the institution's name up front, since a stolen/guessed
 * token shouldn't reveal anything about an invite before it's actually
 * accepted.
 */
export function AcceptInviteCard({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleAccept() {
    setState("loading");
    setMessage(null);
    const response = await acceptInstitutionInvite({ token });
    if ("error" in response) {
      setState("error");
      setMessage(response.error);
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2Icon className="size-8 text-primary" />
          <h1 className="font-heading text-xl font-semibold">You&apos;re in</h1>
          <p className="text-sm text-muted-foreground">You&apos;ve joined your institution.</p>
          <Button className="mt-2" render={<Link href="/dashboard">Go to dashboard</Link>} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {/* sr-only real <h1> — matches the "done" state above (which
          already has a real, visible one) so every state of this
          component has one, not just some. */}
      <h1 className="sr-only">Join your institution</h1>
      <CardHeader>
        <CardTitle>Join your institution</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">Accept this invite to join your institution&apos;s cohort.</p>
        {message && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {message}
          </p>
        )}
        <Button onClick={handleAccept} disabled={state === "loading"} className="mt-2">
          {state === "loading" ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Accepting…
            </>
          ) : (
            "Accept invite"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
