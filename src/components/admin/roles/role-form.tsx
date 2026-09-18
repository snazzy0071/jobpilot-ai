"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { createAdminRole, updateAdminRole } from "@/lib/admin/roles/actions";
import { ADMIN_PERMISSIONS, ADMIN_PERMISSION_LABELS } from "@/lib/admin/permission-types";
import type { AdminRole } from "@/lib/admin/roles/types";

/**
 * The one UI surface that actually configures what a role grants —
 * everywhere else in the admin area only ever *checks* one of these
 * fixed permission keys (src/lib/admin/permissions.ts), never lists or
 * edits the set itself.
 */
export function RoleForm({ role }: { role?: AdminRole }) {
  const router = useRouter();
  const isEditing = !!role;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(role?.isActive ?? true);
  const [permissions, setPermissions] = useState<Set<string>>(new Set(role?.permissions ?? []));

  function togglePermission(permission: string, checked: boolean) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = isEditing ? await updateAdminRole(undefined, formData) : await createAdminRole(formData);

    if (response && "error" in response) {
      setLoading(false);
      setError(response.error);
      return;
    }
    router.push("/admin/roles");
    router.refresh();
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isEditing && <input type="hidden" name="id" value={role.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" name="name" defaultValue={role?.name} maxLength={200} placeholder="e.g. Content Admin" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-slug">Slug</Label>
            <Input id="role-slug" name="slug" defaultValue={role?.slug} maxLength={100} placeholder="e.g. content_admin" required />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role-description">Description</Label>
          <Textarea id="role-description" name="description" defaultValue={role?.description ?? ""} maxLength={2000} rows={2} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Permissions</Label>
          <div className="flex flex-col gap-2">
            {ADMIN_PERMISSIONS.map((permission) => (
              <div key={permission} className="flex items-center gap-2">
                <Checkbox
                  id={`role-permission-${permission}`}
                  name="permissions"
                  value={permission}
                  checked={permissions.has(permission)}
                  onCheckedChange={(checked) => togglePermission(permission, checked === true)}
                />
                <Label htmlFor={`role-permission-${permission}`} className="font-normal">
                  {ADMIN_PERMISSION_LABELS[permission]}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {isEditing && (
          <div className="flex items-center gap-2">
            <Checkbox id="role-active" name="isActive" value="on" checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
            <Label htmlFor="role-active" className="font-normal">
              Active
            </Label>
          </div>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="self-start">
          {loading ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Saving…
            </>
          ) : isEditing ? (
            "Save role"
          ) : (
            "Create role"
          )}
        </Button>
      </form>
    </Card>
  );
}
