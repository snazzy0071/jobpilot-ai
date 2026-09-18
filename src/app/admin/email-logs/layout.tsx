import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminEmailLogsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("view_email_logs");
  return children;
}
