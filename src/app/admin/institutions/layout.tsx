import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminInstitutionsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("manage_institutions");
  return children;
}
