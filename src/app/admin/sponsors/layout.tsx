import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminSponsorsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("view_sponsor_sync");
  return children;
}
