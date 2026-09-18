"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { grantAdminRole, revokeAdminRole } from "@/lib/admin/roles/actions";
import type { AdminAccount, AdminRoleAssignment } from "@/lib/admin/roles/types";
import type { AdminRole } from "@/lib/admin/roles/types";

function accountLabel(account: AdminAccount): string {
  return account.fullName ? `${account.fullName} (${account.email ?? "no email"})` : (account.email ?? account.userId);
}

function GrantForm({ accounts, roles }: { accounts: AdminAccount[]; roles: AdminRole[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [adminRoleId, setAdminRoleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !adminRoleId) return;
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = await grantAdminRole(formData);
    setSubmitting(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    setUserId("");
    setAdminRoleId("");
    router.refresh();
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="grant-account">Account</Label>
          <Select name="userId" value={userId} onValueChange={(value) => value && setUserId(value)}>
            <SelectTrigger id="grant-account" className="w-full">
              <SelectValue placeholder="Choose an admin account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.userId} value={account.userId}>
                  {accountLabel(account)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-48 flex-col gap-1.5">
          <Label htmlFor="grant-role">Role</Label>
          <Select name="adminRoleId" value={adminRoleId} onValueChange={(value) => value && setAdminRoleId(value)}>
            <SelectTrigger id="grant-role" className="w-full">
              <SelectValue placeholder="Choose a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={submitting || !userId || !adminRoleId}>
          {submitting ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Granting…
            </>
          ) : (
            "Grant role"
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

function RevokeButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm("Revoke this role assignment?")) return;
    setPending(true);
    const formData = new FormData();
    formData.set("assignmentId", assignmentId);
    const result = await revokeAdminRole(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Revoke role" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : <XIcon className="size-4" />}
    </Button>
  );
}

export function AssignmentsPanel({
  accounts,
  roles,
  assignments,
}: {
  accounts: AdminAccount[];
  roles: AdminRole[];
  assignments: AdminRoleAssignment[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <GrantForm accounts={accounts} roles={roles} />

      {assignments.length === 0 ? (
        <Card className="items-center gap-2 p-10 text-center text-sm text-muted-foreground">No roles granted yet.</Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Granted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell>
                  <p className="font-medium">{assignment.userFullName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{assignment.userEmail ?? "—"}</p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{assignment.roleName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(assignment.grantedAt).toLocaleDateString("en-GB")}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <RevokeButton assignmentId={assignment.id} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
