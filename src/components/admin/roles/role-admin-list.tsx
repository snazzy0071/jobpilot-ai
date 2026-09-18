"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { deleteAdminRole } from "@/lib/admin/roles/actions";
import { ADMIN_PERMISSION_LABELS } from "@/lib/admin/permission-types";
import type { AdminRole } from "@/lib/admin/roles/types";

function DeleteButton({ role }: { role: AdminRole }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete the "${role.name}" role? Anyone holding it loses those permissions immediately.`)) return;
    setDeleting(true);
    const formData = new FormData();
    formData.set("id", role.id);
    const result = await deleteAdminRole(undefined, formData);
    if (result && "error" in result) {
      setDeleting(false);
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${role.name}`} onClick={handleDelete} disabled={deleting}>
      {deleting ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}

export function RoleAdminList({ roles }: { roles: AdminRole[] }) {
  if (roles.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No admin roles yet</p>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Permissions</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((role) => (
          <TableRow key={role.id}>
            <TableCell>
              <p className="font-medium">{role.name}</p>
              <p className="text-xs text-muted-foreground">{role.slug}</p>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {role.permissions.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None</span>
                ) : (
                  role.permissions.map((permission) => (
                    <Badge key={permission} variant="outline">
                      {ADMIN_PERMISSION_LABELS[permission]}
                    </Badge>
                  ))
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={role.isActive ? "tinted" : "secondary"}>{role.isActive ? "Active" : "Inactive"}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${role.name}`} render={<Link href={`/admin/roles/${role.id}/edit`} />}>
                  <Pencil className="size-4" />
                </Button>
                <DeleteButton role={role} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
