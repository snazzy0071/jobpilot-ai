"use client";

import { useActionState } from "react";
import { subscribeToNewsletter, type NewsletterResult } from "@/lib/newsletter/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewsletterForm() {
  const [state, formAction, pending] = useActionState<NewsletterResult, FormData>(
    subscribeToNewsletter,
    undefined,
  );
  const kept = state && "error" in state ? state.values : undefined;

  if (state && "success" in state) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p role="status" className="font-medium">{state.success}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex flex-1 flex-col gap-2 text-left">
        <Label htmlFor="newsletterEmail" className="sr-only">
          Email
        </Label>
        <input type="hidden" name="source" value="newsletter_page" />
        <Input
          id="newsletterEmail"
          name="email"
          defaultValue={kept?.email}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        {state && "error" in state ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Subscribing..." : "Subscribe"}
      </Button>
    </form>
  );
}
