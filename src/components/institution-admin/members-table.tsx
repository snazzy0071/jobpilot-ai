"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, ShieldIcon, Trash2Icon, UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { updateMemberRole, removeInstitutionMember } from "@/lib/institutions/admin/actions";
import type { AdminInstitutionMember } from "@/lib/institutions/admin/types";

function RoleToggleButton({ member }: { member: AdminInstitutionMember }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const nextRole = member.role === "admin" ? "member" : "admin";

  async function handleClick() {
    setPending(true);
    const formData = new FormData();
    formData.set("memberId", member.id);
    formData.set("role", nextRole);
    const result = await updateMemberRole(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : <ShieldIcon className="size-3.5" />}
      Make {nextRole}
    </Button>
  );
}

function RemoveMemberButton({ member }: { member: AdminInstitutionMember }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    const label = member.fullName ?? member.email ?? "this member";
    if (!window.confirm(`Remove ${label} from your institution? This frees their seat immediately.`)) return;
    setPending(true);
    const formData = new FormData();
    formData.set("memberId", member.id);
    const result = await removeInstitutionMember(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Remove member" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2Icon className="size-4" />}
    </Button>
  );
}

export function MembersTable({ members }: { members: AdminInstitutionMember[] }) {
  if (members.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <UserIcon className="size-6 text-muted-foreground" />
        <p className="font-medium">No members yet</p>
        <p className="text-sm text-muted-foreground">Send an invite or share your institution&apos;s access code to get started.</p>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-medium">{member.fullName ?? "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{member.email ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={member.role === "admin" ? "tinted" : "outline"}>{member.role === "admin" ? "Admin" : "Member"}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{new Date(member.joinedAt).toLocaleDateString("en-GB")}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <RoleToggleButton member={member} />
                <RemoveMemberButton member={member} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
