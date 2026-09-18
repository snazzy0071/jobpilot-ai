import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("manage_settings");
  return children;
}
