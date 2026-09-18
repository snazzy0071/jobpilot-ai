import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminAccessCodesLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("manage_access_codes");
  return children;
}
