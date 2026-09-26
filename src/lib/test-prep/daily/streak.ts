// Calendar-day arithmetic for the daily five and its streak. Pure and timezone-explicit: nothing here reads the server's
// clock or zone, so "today" is always the caller's own local calendar day and the same inputs always give the same streak.

export function isValidTimeZone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** "YYYY-MM-DD" for `date` in `timezone` (en-CA formats in ISO field order, which is also what a Postgres `date` column takes). */
export function localDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** `days` before/after a "YYYY-MM-DD" string. Anchored to a neutral UTC clock purely for the arithmetic — calendar-day counting from a fixed string, so daylight-saving changes cannot skip or repeat a day. */
export function shiftDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export type Streaks = {
  /** Consecutive days ending today — or ending yesterday, when today isn't done yet (the day isn't over, so the streak is still alive). */
  current: number;
  longest: number;
  totalDays: number;
};

/** `completedDates` are distinct local dates the daily five was finished; `today` is the caller's local date. */
export function computeStreaks(completedDates: string[], today: string): Streaks {
  const days = new Set(completedDates);

  let current = 0;
  let cursor = days.has(today) ? today : shiftDateString(today, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = shiftDateString(cursor, -1);
  }

  let longest = 0;
  const sorted = [...days].sort();
  let run = 0;
  let previous: string | null = null;
  for (const date of sorted) {
    run = previous !== null && shiftDateString(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  return { current, longest, totalDays: days.size };
}
