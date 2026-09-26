import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminAutoApplyLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("view_auto_apply");
  return children;
}
