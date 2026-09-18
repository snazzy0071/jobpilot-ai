import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminRolesLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("manage_admin_roles");
  return children;
}
