import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminLeadsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("view_leads");
  return children;
}
