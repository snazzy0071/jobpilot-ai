import { z } from "zod";

// remindAt is an absolute instant (ISO 8601 with an offset or Z). The form converts the person's local date and time
// to that in the browser — the server can't know their time zone, and reading a bare "2026-03-05T14:30" here would
// silently mean UTC and fire an hour early all summer. A reminder more than a minute in the past is refused: it could
// never remind anyone of anything.
const remindAtField = z.iso
  .datetime({ offset: true, message: "Enter a valid date and time." })
  .refine((value) => new Date(value).getTime() >= Date.now() - 60_000, "Choose a time in the future.")
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
