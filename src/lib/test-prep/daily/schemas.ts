import { z } from "zod";

// Bounds the shape before actions.ts's own isValidTimeZone runs the
// real check via Intl.DateTimeFormat — that's the actual source of
// truth for "is this a real IANA zone name", not this regex-free bound.
const timezoneSchema = z.string().trim().min(1).max(100);

export const getDailyPracticeStatusSchema = z.object({ timezone: timezoneSchema });

export const startDailyPracticeSchema = z.object({ timezone: timezoneSchema });

export const recordDailyCompletionSchema = z.object({
  testSessionId: z.string().uuid(),
  timezone: timezoneSchema,
});
