// Two window shapes, both already precedented before this file existed
// (this just gives them one shared home instead of each caller
// reimplementing its own copy):
//
// - A *fixed-length* window (getFixedWindowStart) — arbitrary duration,
//   floor-divided against the epoch, originally src/lib/ai/rate-limit.ts's
//   own getCurrentWindowStart(). Right shape for "N requests per X
//   minutes" abuse/burst protection with no natural calendar meaning.
// - A *calendar-aligned* window (getCalendarWindowStart) — originally
//   src/lib/quick-scan/rate-limit.ts's own getCurrentDayStart()/
//   getCurrentMonthStart(). Right shape for a limit that's meant to read
//   as "2 per calendar month", where the window boundary itself is part
//   of what's communicated to the person hitting it.

export function getFixedWindowStart(windowSeconds: number): string {
  const windowMs = windowSeconds * 1000;
  const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
  return new Date(windowStartMs).toISOString();
}

export type CalendarAlignment = "hour" | "day" | "month";

export function getCalendarWindowStart(alignment: CalendarAlignment): string {
  const now = new Date();
  switch (alignment) {
    case "hour":
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours())).toISOString();
    case "day":
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    case "month":
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }
}
