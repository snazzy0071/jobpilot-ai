"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { setInstitutionDomainVerified } from "@/lib/admin/institutions/actions";
import type { AdminInstitutionDomain } from "@/lib/admin/institutions/types";

function DomainRow({ domain }: { domain: AdminInstitutionDomain }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("domainId", domain.id);
    formData.set("verified", String(!domain.isVerified));
    const result = await setInstitutionDomainVerified(formData);
    setPending(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2" data-domain={domain.domain}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{domain.domain}</span>
        <Badge variant={domain.isVerified ? "tinted" : "secondary"}>{domain.isVerified ? "Verified" : "Unverified"}</Badge>
      </div>
      <Button size="sm" variant="outline" onClick={toggle} disabled={pending} aria-label={`${domain.isVerified ? "Unverify" : "Verify"} ${domain.domain}`}>
        {domain.isVerified ? "Unverify" : "Verify"}
      </Button>
      {error && (
        <p className="w-full text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

/** JobPilot-admin view of the domains an institution has claimed. Only a verified domain enrols people automatically. */
export function DomainsAdminPanel({ domains }: { domains: AdminInstitutionDomain[] }) {
  return (
    <Card className="gap-4 p-6">
      <h2 className="text-sm font-semibold">Email domains</h2>
      <p className="text-xs text-muted-foreground">
        Institution admins claim domains; nothing happens until you verify one. Verify only after confirming the institution controls the domain. Once verified, anyone who confirms an email address at it joins as a member (while seats last).
      </p>
      {domains.length === 0 ? (
        <p className="text-sm text-muted-foreground">No domains claimed.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {domains.map((domain) => (
            <DomainRow key={domain.id} domain={domain} />
          ))}
        </ul>
      )}
    </Card>
  );
}
