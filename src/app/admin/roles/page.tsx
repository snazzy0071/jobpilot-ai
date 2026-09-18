import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAdminRoles, listAdminAccounts, listAdminRoleAssignments } from "@/lib/admin/roles/queries";
import { RoleAdminList } from "@/components/admin/roles/role-admin-list";
import { AssignmentsPanel } from "@/components/admin/roles/assignments-panel";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const [roles, accounts, assignments] = await Promise.all([listAdminRoles(), listAdminAccounts(), listAdminRoleAssignments()]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Admin roles</h1>
          <p className="mt-1 text-muted-foreground">Configure which admin areas each role can access, then grant roles to staff accounts.</p>
        </div>
        <Button render={<Link href="/admin/roles/new"><PlusIcon /> New role</Link>} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Roles</h2>
        <RoleAdminList roles={roles} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Assignments</h2>
        <AssignmentsPanel accounts={accounts} roles={roles} assignments={assignments} />
      </div>
    </div>
  );
}
