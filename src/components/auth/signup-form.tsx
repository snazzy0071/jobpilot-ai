"use client";

import { useActionState, useState } from "react";
import { signUpWithPassword, type AuthResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTodayIsoDate } from "@/lib/hooks/use-today-iso-date";

type SignupMode = "subscribe" | "access_code";

export function SignupForm() {
  const [mode, setMode] = useState<SignupMode>("subscribe");
  const today = useTodayIsoDate();
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    signUpWithPassword,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Tabs value={mode} onValueChange={(value) => setMode(value as SignupMode)}>
        <TabsList className="w-full">
          <TabsTrigger value="subscribe">Subscribe</TabsTrigger>
          <TabsTrigger value="access_code">Access code</TabsTrigger>
        </TabsList>
      </Tabs>
      <input type="hidden" name="mode" value={mode} />

      {mode === "access_code" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="accessCode">Access code</Label>
          <Input id="accessCode" name="accessCode" type="text" required autoComplete="off" />
          <p className="text-xs text-muted-foreground">
            From your university or employer. Grants free access instead of a subscription.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" type="text" required autoComplete="name" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          required
          max={today}
          autoComplete="bday"
        />
        <p className="text-xs text-muted-foreground">
          You must be at least 13 years old to create an account.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="flex items-start gap-2">
        <Checkbox id="newsletterOptIn" name="newsletterOptIn" value="on" className="mt-0.5" />
        <Label htmlFor="newsletterOptIn" className="text-sm font-normal text-muted-foreground">
          Send me occasional emails about new features and career tips. You can unsubscribe
          anytime.
        </Label>
      </div>

      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
