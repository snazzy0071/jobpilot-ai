import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminBlogLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("manage_blog");
  return children;
}
