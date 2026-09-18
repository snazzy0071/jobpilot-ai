import { z } from "zod";

export const updateAppSettingsSchema = z.object({
  maintenanceMode: z.coerce.boolean(),
  announcementActive: z.coerce.boolean(),
  announcementMessage: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : null)),
});
