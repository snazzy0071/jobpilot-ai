"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon, RefreshCwIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { createInstitutionInvite, revokeInstitutionInvite, resendInstitutionInvite } from "@/lib/institutions/admin/actions";
import { INSTITUTION_MEMBER_ROLES, type InstitutionMemberRole } from "@/lib/institutions/types";
import type { AdminInstitutionInvite } from "@/lib/institutions/admin/types";

function inviteStatus(invite: AdminInstitutionInvite): { label: string; variant: "tinted" | "outline" | "secondary" } {
  if (invite.acceptedAt) return { label: "Accepted", variant: "tinted" };
  if (new Date(invite.expiresAt) < new Date()) return { label: "Expired", variant: "secondary" };
  return { label: "Pending", variant: "outline" };
}

function CreateInviteForm() {
  const router = useRouter();
  const [role, setRole] = useState<InstitutionMemberRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = await createInstitutionInvite(formData);
    setSubmitting(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    event.currentTarget.reset();
    setRole("member");
    router.refresh();
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" name="email" type="email" placeholder="student@university.ac.uk" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <Select name="role" items={{ admin: "Admin", member: "Member" }} value={role} onValueChange={(value) => value && setRole(value as InstitutionMemberRole)}>
            <SelectTrigger id="invite-role" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSTITUTION_MEMBER_ROLES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "admin" ? "Admin" : "Member"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send invite"
          )}
        </Button>
      </form>
      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {error}
        </p>
      )}
    </Card>
  );
}

function RevokeButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm("Revoke this invite? The link will stop working immediately.")) return;
    setPending(true);
    const formData = new FormData();
    formData.set("inviteId", inviteId);
    const result = await revokeInstitutionInvite(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Revoke invite" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : <XIcon className="size-4" />}
    </Button>
  );
}

function ResendButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const formData = new FormData();
    formData.set("inviteId", inviteId);
    const result = await resendInstitutionInvite(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Resend invite" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
    </Button>
  );
}

export function InvitesPanel({ invites }: { invites: AdminInstitutionInvite[] }) {
  return (
    <div className="flex flex-col gap-6">
      <CreateInviteForm />

      {invites.length === 0 ? (
        <Card className="items-center gap-2 p-10 text-center text-sm text-muted-foreground">No invites sent yet.</Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              return (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{invite.role === "admin" ? "Admin" : "Member"}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(invite.expiresAt).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell>
                    {!invite.acceptedAt && (
                      <div className="flex justify-end gap-1">
                        <ResendButton inviteId={invite.id} />
                        <RevokeButton inviteId={invite.id} />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
