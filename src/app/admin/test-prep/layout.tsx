import { requirePermission } from "@/lib/admin/permissions";

export default async function AdminTestPrepLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("manage_test_prep");
  return children;
}
