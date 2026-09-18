import { z } from "zod";
import { PAID_PLAN_SLUGS, BILLING_CYCLES } from "@/lib/billing/types";

export const createCheckoutSessionSchema = z.object({
  planSlug: z.enum(PAID_PLAN_SLUGS, "Choose a valid plan"),
  billingCycle: z.enum(BILLING_CYCLES, "Choose monthly or annual billing"),
});
