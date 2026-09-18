import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminSystemHealthLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("view_system_health");
  return children;
}
