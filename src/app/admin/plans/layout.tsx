import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminPlansLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("view_plans");
  return children;
}
