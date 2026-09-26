import { z } from "zod";
import { INSTITUTION_MEMBER_ROLES } from "@/lib/institutions/types";
import { normaliseDomain, PUBLIC_MAIL_DOMAINS } from "@/lib/institutions/licence";

export const updateBrandingSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  logoUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^https:\/\//.test(value), "Logo URL must start with https://"),
  primaryColor: z
    .string()
    .trim()
    .max(7)
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^#[0-9a-fA-F]{6}$/.test(value), "Enter a hex color like #1D4ED8"),
  welcomeMessage: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value ? value : null)),
});

export const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(320),
  role: z.enum(INSTITUTION_MEMBER_ROLES),
});

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(INSTITUTION_MEMBER_ROLES),
});

export const memberIdSchema = z.object({
  memberId: z.string().uuid(),
});

export const inviteIdSchema = z.object({
  inviteId: z.string().uuid(),
});

export const claimDomainSchema = z.object({
  domain: z
    .string()
    .transform((value) => normaliseDomain(value))
    .refine((value): value is string => value !== null, "Enter a domain like students.university.ac.uk")
    .refine((value) => !PUBLIC_MAIL_DOMAINS.has(value), "Public email providers can't be claimed as an institution domain"),
});

export const domainIdSchema = z.object({ domainId: z.string().uuid() });
