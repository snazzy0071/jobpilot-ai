"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimInstitutionDomain, removeInstitutionDomain } from "@/lib/institutions/admin/actions";

type Domain = { id: string; domain: string; isVerified: boolean; createdAt: string };

function RemoveButton({ domain }: { domain: Domain }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function handleClick() {
    if (!window.confirm(`Remove ${domain.domain}? People at this domain will no longer join automatically.`)) return;
    setPending(true);
    const formData = new FormData();
    formData.set("domainId", domain.id);
    const result = await removeInstitutionDomain(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }
  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending} aria-label={`Remove ${domain.domain}`}>
      <XIcon className="size-4" /> Remove
    </Button>
  );
}

export function DomainsPanel({ domains }: { domains: Domain[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setError(null);
    const result = await claimInstitutionDomain(new FormData(form));
    setSubmitting(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3" aria-label="Claim a domain">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="domain-input">Email domain</Label>
            <Input id="domain-input" name="domain" placeholder="students.university.ac.uk" required />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2Icon className="size-4 animate-spin" /> Claiming…
              </>
            ) : (
              "Claim domain"
            )}
          </Button>
        </form>
        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}
      </Card>

      {domains.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">You haven&apos;t claimed any domains yet.</Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y">
            {domains.map((domain) => (
              <li key={domain.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3" data-domain={domain.domain}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{domain.domain}</span>
                  <Badge variant={domain.isVerified ? "tinted" : "secondary"}>{domain.isVerified ? "Verified" : "Awaiting verification"}</Badge>
                </div>
                <RemoveButton domain={domain} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
