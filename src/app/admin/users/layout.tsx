import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("manage_users");
  return children;
}
