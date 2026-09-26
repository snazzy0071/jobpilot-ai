import type { LicenceState } from "@/lib/institutions/licence";

export type AdminInstitutionListItem = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  hasActiveLicence: boolean;
  createdAt: string;
};

export type AdminInstitutionAdminAccount = {
  userId: string;
  fullName: string | null;
  email: string | null;
};

export type AdminInstitutionLicenceDetail = {
  id: string;
  planName: string;
  seatCount: number;
  startsAt: string;
  expiresAt: string | null;
  isActive: boolean;
  state: LicenceState;
};

export type AdminInstitutionDetail = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  licence: AdminInstitutionLicenceDetail | null;
  admins: AdminInstitutionAdminAccount[];
  domains: AdminInstitutionDomain[];
  seatsUsed: number;
};

export type AdminInstitutionDomain = { id: string; domain: string; isVerified: boolean; createdAt: string };
