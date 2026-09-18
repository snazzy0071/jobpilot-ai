import { z } from "zod";

export const redeemAccessCodeSchema = z.object({
  code: z.string().trim().min(1).max(100),
});

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(1).max(200),
});
