"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, BuildingIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { redeemInstitutionAccessCode, checkDomainEnrollment } from "@/lib/institutions/enrollment/actions";
import type { CurrentInstitutionMembership } from "@/lib/institutions/queries";

type Notice = { tone: "error" | "success"; text: string };

function NoticeText({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p
      className={`flex items-center gap-1.5 text-sm ${notice.tone === "error" ? "text-destructive" : "text-primary"}`}
      role={notice.tone === "error" ? "alert" : undefined}
    >
      {notice.tone === "error" ? <AlertCircleIcon className="size-4 shrink-0" /> : <CheckCircle2Icon className="size-4 shrink-0" />}
      {notice.text}
    </p>
  );
}

/**
 * Two of the three enrollment paths this app supports (migration 0073):
 * an access code, or an approved email domain. The third — an
 * invitation link — has no place here by design: it's accepted from
 * its own emailed link (/institution-invite/[token]), which already
 * carries the one thing this panel can't ask for, the raw token.
 *
 * On a successful join, `router.refresh()` re-runs the server
 * component this is rendered under so the *real* institution name (not
 * a guessed placeholder) replaces this panel with the membership card
 * below.
 */
export function InstitutionEnrollmentPanel({ membership }: { membership: CurrentInstitutionMembership | null }) {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeNotice, setCodeNotice] = useState<Notice | null>(null);

  const [domainChecking, setDomainChecking] = useState(false);
  const [domainNotice, setDomainNotice] = useState<Notice | null>(null);

  async function handleRedeemCode() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setCodeSubmitting(true);
    setCodeNotice(null);
    const response = await redeemInstitutionAccessCode({ code: trimmed });
    setCodeSubmitting(false);

    if ("error" in response) {
      setCodeNotice({ tone: "error", text: response.error });
      return;
    }
    setCode("");
    if (response.institutionJoined) {
      setCodeNotice({ tone: "success", text: "Code redeemed — you've joined your institution." });
      router.refresh();
    } else if (response.institutionId) {
      setCodeNotice({
        tone: "success",
        text: "Code redeemed — you're already a member of a different institution, so that wasn't changed.",
      });
    } else {
      setCodeNotice({ tone: "success", text: "Code redeemed." });
    }
  }

  async function handleCheckDomain() {
    setDomainChecking(true);
    setDomainNotice(null);
    const response = await checkDomainEnrollment();
    setDomainChecking(false);

    if ("error" in response) {
      setDomainNotice({ tone: "error", text: response.error });
      return;
    }
    if (!response.matched) {
      setDomainNotice({ tone: "error", text: "Your email domain isn't approved by any institution yet." });
      return;
    }
    if (response.joined) {
      setDomainNotice({ tone: "success", text: "Your email domain matched — you've joined your institution." });
      router.refresh();
    } else {
      setDomainNotice({
        tone: "success",
        text: "Your email domain matched, but you're already a member of a different institution.",
      });
    }
  }

  if (membership) {
    return (
      <Card className="flex-row items-center gap-3 p-4">
        <BuildingIcon className="size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium">{membership.institutionName}</p>
          <p className="text-xs text-muted-foreground">{membership.role === "admin" ? "Institution administrator" : "Member"}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Have an institution access code?</p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Enter code"
            className="max-w-xs"
            aria-label="Institution access code"
          />
          <Button onClick={handleRedeemCode} disabled={codeSubmitting || !code.trim()}>
            {codeSubmitting ? (
              <>
                <Loader2Icon className="size-4 animate-spin" /> Redeeming…
              </>
            ) : (
              "Redeem"
            )}
          </Button>
        </div>
        <NoticeText notice={codeNotice} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Have a university or employer email?</p>
        <p className="text-sm text-muted-foreground">
          If your email domain is approved by an institution, you can join automatically.
        </p>
        <Button variant="outline" onClick={handleCheckDomain} disabled={domainChecking} className="self-start">
          {domainChecking ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Checking…
            </>
          ) : (
            "Check my email domain"
          )}
        </Button>
        <NoticeText notice={domainNotice} />
      </div>
    </div>
  );
}
