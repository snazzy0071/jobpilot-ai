"use client";

import { useActionState } from "react";
import { submitPartnerInquiry, type PartnerInquiryResult } from "@/lib/partners/actions";
import { PARTNERSHIP_TYPES } from "@/lib/partners/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PartnerInquiryForm() {
  const [state, formAction, pending] = useActionState<PartnerInquiryResult, FormData>(
    submitPartnerInquiry,
    undefined,
  );

  if (state && "success" in state) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="font-medium">{state.success}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 text-left">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="organisationName">Organisation name</Label>
          <Input id="organisationName" name="organisationName" type="text" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contactName">Your name</Label>
          <Input id="contactName" name="contactName" type="text" required autoComplete="name" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="partnershipType">Partnership type</Label>
          <Select name="partnershipType" defaultValue={PARTNERSHIP_TYPES[0]}>
            <SelectTrigger id="partnershipType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTNERSHIP_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Tell us about the partnership you have in mind</Label>
        <Textarea id="message" name="message" required rows={5} minLength={10} />
      </div>

      {state && "error" in state ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending..." : "Submit inquiry"}
      </Button>
    </form>
  );
}
