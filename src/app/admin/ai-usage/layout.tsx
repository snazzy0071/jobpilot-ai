import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminAiUsageLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("view_ai_usage");
  return children;
}
