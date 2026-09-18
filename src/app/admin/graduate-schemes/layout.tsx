import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminGraduateSchemesLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("manage_graduate_schemes");
  return children;
}
