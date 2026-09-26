"use client";

import { useActionState } from "react";
import { requestDemo, type DemoRequestResult } from "@/lib/demo/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DemoRequestForm() {
  const [state, formAction, pending] = useActionState<DemoRequestResult, FormData>(
    requestDemo,
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
        <Label htmlFor="institutionName">Institution name</Label>
        <Input id="institutionName" name="institutionName" defaultValue={kept?.institutionName} type="text" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="contactName">Your name</Label>
          <Input id="contactName" name="contactName" defaultValue={kept?.contactName} type="text" required autoComplete="name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role">Role</Label>
          <Input id="role" name="role" defaultValue={kept?.role} type="text" placeholder="e.g. Careers Adviser" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" defaultValue={kept?.email} type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="studentPopulation">Student population</Label>
          <Input id="studentPopulation" name="studentPopulation" defaultValue={kept?.studentPopulation} type="text" placeholder="e.g. 5,000–15,000" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Anything else we should know?</Label>
        <Textarea id="message" name="message" defaultValue={kept?.message} rows={4} />
      </div>

      {state && "error" in state ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending..." : "Request a demo"}
      </Button>
    </form>
  );
}
