"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAccessCode } from "@/lib/admin/access-codes/actions";
import type { AdminAccessCodeOption, AdminPlanOption } from "@/lib/admin/access-codes/types";

const NONE = "__none__";

export function AccessCodeForm({ institutions, plans }: { institutions: AdminAccessCodeOption[]; plans: AdminPlanOption[] }) {
  const router = useRouter();
  const [institutionId, setInstitutionId] = useState(NONE);
  const [grantedPlanId, setGrantedPlanId] = useState(NONE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    if (formData.get("institutionId") === NONE) formData.delete("institutionId");
    if (formData.get("grantedPlanId") === NONE) formData.delete("grantedPlanId");

    const result = await createAccessCode(formData);
    setSubmitting(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    event.currentTarget.reset();
    setInstitutionId(NONE);
    setGrantedPlanId(NONE);
    router.refresh();
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-label">Label</Label>
            <Input id="ac-label" name="label" maxLength={200} placeholder="e.g. Manchester Uni cohort 2026" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-code">Code (leave blank to generate)</Label>
            <Input id="ac-code" name="code" maxLength={50} placeholder="e.g. MANC2026" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-max">Max redemptions (blank = unlimited)</Label>
            <Input id="ac-max" name="maxRedemptions" type="number" min={1} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-expires">Expires (blank = never)</Label>
            <Input id="ac-expires" name="expiresAt" type="date" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-institution">Institution</Label>
            <Select name="institutionId" items={{ [NONE]: "None", ...Object.fromEntries(institutions.map((institution) => [institution.id, institution.name])) }} value={institutionId} onValueChange={(value) => value && setInstitutionId(value)}>
              <SelectTrigger id="ac-institution" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {institutions.map((institution) => (
                  <SelectItem key={institution.id} value={institution.id}>
                    {institution.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-plan">Grants plan</Label>
            <Select name="grantedPlanId" items={{ [NONE]: "None (redemption only)", ...Object.fromEntries(plans.map((plan) => [plan.id, plan.name])) }} value={grantedPlanId} onValueChange={(value) => value && setGrantedPlanId(value)}>
              <SelectTrigger id="ac-plan" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None (redemption only)</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Creating…
            </>
          ) : (
            "Create access code"
          )}
        </Button>
      </form>
    </Card>
  );
}
