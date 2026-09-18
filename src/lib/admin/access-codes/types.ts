export type AdminAccessCode = {
  id: string;
  code: string;
  label: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  isActive: boolean;
  expiresAt: string | null;
  institutionName: string | null;
  grantedPlanSlug: string | null;
  createdAt: string;
};

export type AdminAccessCodeOption = { id: string; name: string };
export type AdminPlanOption = { id: string; slug: string; name: string };
