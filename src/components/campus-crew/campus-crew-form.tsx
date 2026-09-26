"use client";

import { useActionState } from "react";
import { submitCampusCrewApplication, type CampusCrewResult } from "@/lib/campus-crew/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CampusCrewForm() {
  const [state, formAction, pending] = useActionState<CampusCrewResult, FormData>(submitCampusCrewApplication, undefined);
  const kept = state && "error" in state ? state.values : undefined;

  if (state && "success" in state) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p role="status" className="font-medium">
          {state.success}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 text-left">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" defaultValue={kept?.name} type="text" required autoComplete="name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" defaultValue={kept?.email} type="email" required autoComplete="email" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="university">University or college</Label>
        <Input id="university" name="university" defaultValue={kept?.university} type="text" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="course">Course (optional)</Label>
          <Input id="course" name="course" defaultValue={kept?.course} type="text" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="studyYear">Year of study (optional)</Label>
          <Input id="studyYear" name="studyYear" defaultValue={kept?.studyYear} type="text" placeholder="e.g. 2nd year" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="motivation">Why do you want to be on the Campus Crew?</Label>
        <Textarea id="motivation" name="motivation" defaultValue={kept?.motivation} required rows={5} minLength={10} maxLength={3000} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reach">Which groups or societies could you reach? (optional)</Label>
        <Textarea id="reach" name="reach" defaultValue={kept?.reach} rows={3} maxLength={1000} />
      </div>

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending..." : "Apply to the Campus Crew"}
      </Button>
    </form>
  );
}
