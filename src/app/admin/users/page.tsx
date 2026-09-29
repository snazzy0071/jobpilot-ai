import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { UsersTable } from "@/components/admin/users/users-table";
import { listAdminUsers } from "@/lib/admin/users/queries";
import type { AdminUserFilters } from "@/lib/admin/users/types";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = ["", "user", "institution_admin", "admin"] as const;
const PLAN_STATUS_OPTIONS = ["", "free", "active", "trialing", "past_due", "canceled", "incomplete"] as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string; planStatus?: string }>;
}) {
  const params = await searchParams;
  const filters: AdminUserFilters = {
    search: params.search || undefined,
    role: (params.role as AdminUserFilters["role"]) || undefined,
    planStatus: (params.planStatus as AdminUserFilters["planStatus"]) || undefined,
  };
  const users = await listAdminUsers(filters);

  return (
    <div className="flex flex-col gap-6">
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <label htmlFor="search" className="text-sm font-medium">
            Search
          </label>
          <Input id="search" name="search" defaultValue={params.search ?? ""} placeholder="Name or email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-sm font-medium">
            Role
          </label>
          <NativeSelect
            id="role"
            name="role"
            defaultValue={params.role ?? ""}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role || "Any role"}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="planStatus" className="text-sm font-medium">
            Plan status
          </label>
          <NativeSelect
            id="planStatus"
            name="planStatus"
            defaultValue={params.planStatus ?? ""}
          >
            {PLAN_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status || "Any status"}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">Filter</Button>
        {(params.search || params.role || params.planStatus) && (
          <Button type="button" variant="ghost" render={<Link href="/admin/users">Clear</Link>} />
        )}
      </form>

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts match these filters.</p>
      ) : (
        <UsersTable users={users} />
      )}
    </div>
  );
}
