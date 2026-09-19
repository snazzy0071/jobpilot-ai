export type CountKind = "number" | "gbp" | "usd" | "percent";

/** Money stays exact: pence in, pounds out. Costs under $10 get a third decimal so a few cents of AI spend doesn't read as $0.01. */
export function formatCount(value: number, kind: CountKind = "number"): string {
  switch (kind) {
    case "gbp":
      return (value / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "usd":
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: Math.abs(value) < 10 && value !== 0 ? 3 : 2,
      });
    case "percent":
      return `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
    default:
      return Math.round(value).toLocaleString("en-GB");
  }
}

export function formatDay(iso: string, style: "short" | "long" = "short"): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(
    "en-GB",
    style === "long" ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" },
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "Never";
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Percentage change vs the previous window; `null` when there's no previous figure to compare with (never a made-up 100%). */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
