"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInstitutionLicence, deactivateInstitutionLicence, updateInstitutionLicence } from "@/lib/admin/institutions/actions";
import { LICENCE_STATE_LABELS } from "@/lib/institutions/licence";
import type { AdminInstitutionLicenceDetail } from "@/lib/admin/institutions/types";

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No expiry";
}

function DeactivateButton({ licenceId }: { licenceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm("Deactivate this licence? Members/invites will stop being able to consume its seats immediately.")) return;
    setPending(true);
    const formData = new FormData();
    formData.set("licenceId", licenceId);
    const result = await deactivateInstitutionLicence(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      Deactivate licence
    </Button>
  );
}

function EditLicenceForm({ licence, seatsUsed }: { licence: AdminInstitutionLicenceDetail; seatsUsed: number }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    const result = await updateInstitutionLicence(new FormData(event.currentTarget));
    setSubmitting(false);
    if (result && "error" in result) {
      setNotice({ error: true, text: result.error });
      return;
    }
    setNotice({ error: false, text: "Licence updated." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-label="Edit licence">
      <input type="hidden" name="licenceId" value={licence.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lic-edit-seats">Seat count ({seatsUsed} in use)</Label>
          <Input id="lic-edit-seats" name="seatCount" type="number" min={Math.max(1, seatsUsed)} defaultValue={licence.seatCount} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lic-edit-expires">Expires (blank = never)</Label>
          <Input id="lic-edit-expires" name="expiresAt" type="date" defaultValue={licence.expiresAt ? licence.expiresAt.slice(0, 10) : ""} />
        </div>
      </div>
      {notice && (
        <p className={notice.error ? "flex items-center gap-1.5 text-sm text-destructive" : "text-sm text-muted-foreground"} role={notice.error ? "alert" : "status"}>
          {notice.error && <AlertCircleIcon className="size-4 shrink-0" />} {notice.text}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={submitting} className="self-start">
        {submitting ? "Saving…" : "Save licence changes"}
      </Button>
    </form>
  );
}

function CreateLicenceForm({ institutionId, plans }: { institutionId: string; plans: { id: string; name: string }[] }) {
  const router = useRouter();
  const [planId, setPlanId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!planId) return;
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = await createInstitutionLicence(formData);
    setSubmitting(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="institutionId" value={institutionId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lic-plan">Plan</Label>
          <Select name="planId" value={planId} onValueChange={(value) => value && setPlanId(value)}>
            <SelectTrigger id="lic-plan" className="w-full">
              <SelectValue placeholder="Choose a plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lic-seats">Seat count</Label>
          <Input id="lic-seats" name="seatCount" type="number" min={1} defaultValue={50} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lic-expires">Expires (blank = never)</Label>
          <Input id="lic-expires" name="expiresAt" type="date" />
        </div>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" disabled={submitting || !planId} className="self-start">
        {submitting ? (
          <>
            <Loader2Icon className="size-4 animate-spin" /> Creating…
          </>
        ) : (
          "Create licence"
        )}
      </Button>
    </form>
  );
}

export function LicencePanel({
  institutionId,
  licence,
  plans,
  seatsUsed,
}: {
  institutionId: string;
  licence: AdminInstitutionLicenceDetail | null;
  plans: { id: string; name: string }[];
  seatsUsed: number;
}) {
  return (
    <Card className="gap-4 p-6">
      <h2 className="text-sm font-semibold">Licence</h2>
      {licence ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              {licence.planName} · {licence.seatCount} seats
            </p>
            <Badge variant={licence.state === "active" ? "tinted" : "secondary"} data-testid="licence-state">{LICENCE_STATE_LABELS[licence.state]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDate(licence.startsAt)} – {formatDate(licence.expiresAt)}
          </p>
          {licence.state === "expired" && <p className="text-sm text-destructive" role="status">This licence has expired: no seats can be added and members have lost the plan it provided. Extend the expiry to renew it.</p>}
          <EditLicenceForm licence={licence} seatsUsed={seatsUsed} />
          <DeactivateButton licenceId={licence.id} />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">No active licence — members and invites can&apos;t be added until one exists.</p>
          <CreateLicenceForm institutionId={institutionId} plans={plans} />
        </>
      )}
    </Card>
  );
}
