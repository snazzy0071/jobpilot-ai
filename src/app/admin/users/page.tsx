import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { listAdminUsers } from "@/lib/admin/users/queries";
import type { AdminUserFilters } from "@/lib/admin/users/types";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = ["", "user", "institution_admin", "admin"] as const;
const PLAN_STATUS_OPTIONS = ["", "free", "active", "trialing", "past_due", "canceled", "incomplete"] as const;

function planStatusLabel(status: string | null, planSlug: string): string {
  if (!status) return "Free";
  return `${planSlug} · ${status}`;
}

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
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-muted-foreground">{users.length.toLocaleString()} account{users.length === 1 ? "" : "s"}.</p>
      </div>

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
          <select
            id="role"
            name="role"
            defaultValue={params.role ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role || "Any role"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="planStatus" className="text-sm font-medium">
            Plan status
          </label>
          <select
            id="planStatus"
            name="planStatus"
            defaultValue={params.planStatus ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {PLAN_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status || "Any status"}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Filter</Button>
        {(params.search || params.role || params.planStatus) && (
          <Button type="button" variant="ghost" render={<Link href="/admin/users">Clear</Link>} />
        )}
      </form>

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts match these filters.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Link href={`/admin/users/${user.id}`} className="font-medium hover:underline">
                    {user.fullName ?? "—"}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "tinted" : "outline"}>{user.role}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{planStatusLabel(user.subscriptionStatus, user.planSlug)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(user.createdAt).toLocaleDateString("en-GB")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
