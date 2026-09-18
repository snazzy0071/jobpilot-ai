import { z } from "zod";

// remindAt comes from a <input type="datetime-local"> value
// ("2026-03-05T14:30") — validated as a real, parseable date/time
// rather than trusted as-is, then converted to a full ISO string
// before it ever reaches the database.
const remindAtField = z
  .string()
  .trim()
  .min(1, "Choose a date and time.")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date and time.")
  .transform((value) => new Date(value).toISOString());

export const createReminderSchema = z
  .object({
    applicationId: z.string().uuid(),
    remindAt: remindAtField,
    message: z.string().trim().min(1, "Enter a reminder message.").max(500),
    sendEmail: z.coerce.boolean().default(false),
    sendInApp: z.coerce.boolean().default(true),
  })
  .refine((data) => data.sendEmail || data.sendInApp, {
    message: "Choose at least one delivery channel.",
    path: ["sendInApp"],
  });

export const deleteReminderSchema = z.object({ id: z.string().uuid() });
export const completeReminderSchema = z.object({ id: z.string().uuid() });
