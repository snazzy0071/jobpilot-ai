import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminComparisonsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("manage_comparisons");
  return children;
}
