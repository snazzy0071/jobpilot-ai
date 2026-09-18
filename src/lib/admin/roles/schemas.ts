import { z } from "zod";
import { ADMIN_PERMISSIONS } from "@/lib/admin/permission-types";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required")
  .max(100)
  .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only");

export const createAdminRoleSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value ? value : null)),
  permissions: z.array(z.enum(ADMIN_PERMISSIONS)).default([]),
});

export const updateAdminRoleSchema = createAdminRoleSchema.extend({
  id: z.string().uuid(),
  isActive: z.coerce.boolean(),
});

export const deleteAdminRoleSchema = z.object({ id: z.string().uuid() });

export const grantAdminRoleSchema = z.object({
  userId: z.string().uuid(),
  adminRoleId: z.string().uuid(),
});

export const revokeAdminRoleSchema = z.object({
  assignmentId: z.string().uuid(),
});
