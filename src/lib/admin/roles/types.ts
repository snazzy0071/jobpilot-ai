import type { AdminPermission } from "@/lib/admin/permission-types";

export type AdminRole = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  permissions: AdminPermission[];
  isActive: boolean;
};

/** Every account flagged `profiles.role = 'admin'` — the pool a role can actually be granted to (migration 0075's own trigger enforces this server-side too). */
export type AdminAccount = {
  userId: string;
  fullName: string | null;
  email: string | null;
};

export type AdminRoleAssignment = {
  id: string;
  userId: string;
  adminRoleId: string;
  roleName: string;
  userFullName: string | null;
  userEmail: string | null;
  grantedAt: string;
};
