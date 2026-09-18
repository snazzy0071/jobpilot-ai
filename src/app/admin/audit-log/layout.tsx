import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminAuditLogLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("view_audit_logs");
  return children;
}
