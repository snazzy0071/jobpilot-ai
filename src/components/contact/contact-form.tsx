"use client";

import { useActionState } from "react";
import { submitContactMessage, type ContactResult } from "@/lib/contact/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ContactForm() {
  const [state, formAction, pending] = useActionState<ContactResult, FormData>(
    submitContactMessage,
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
    <form action={formAction} className="flex flex-col gap-4 text-left">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={kept?.name} type="text" required autoComplete="name" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" defaultValue={kept?.email} type="email" required autoComplete="email" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" defaultValue={kept?.subject} type="text" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" defaultValue={kept?.message} required rows={6} minLength={10} />
      </div>

      {state && "error" in state ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}
