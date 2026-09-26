import { requirePermission } from "@/lib/admin/permissions";

// The Advice Hub has its own permission, separate from the Blog's.
export default async function AdminAdviceHubLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("manage_advice_hub");
  return children;
}
