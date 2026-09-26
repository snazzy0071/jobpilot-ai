import { requirePermission } from "@/lib/admin/permissions";

// Dates are graduate-scheme data, so the same permission governs them.
export default async function AdminDeadlinesLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("manage_graduate_schemes");
  return children;
}
