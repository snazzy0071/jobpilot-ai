import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminJobsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("view_job_sync");
  return children;
}
