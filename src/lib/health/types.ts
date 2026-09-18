// Plain constants/types only — no "server-only" import — since the
// public /status page and the internal /admin/system-health page both
// need this, and one of those is a Server Component that itself calls
// the (server-only) check functions, not something that needs the type
// to cross a client boundary — kept separate anyway for the same
// "types file stays importable everywhere, logic file stays
// server-only" split this app already uses elsewhere
// (src/lib/admin/permission-types.ts vs. permissions.ts).

export type HealthStatus = "operational" | "degraded" | "down" | "not_configured";

export type HealthCheckResult = {
  key: string;
  label: string;
  status: HealthStatus;
  /**
   * Internal-only diagnostic text — a caught error's own message, a
   * "last synced Xh ago" note, a source-by-source breakdown. Rendered
   * on `/admin/system-health` for an admin with `view_system_health`;
   * the public `/status` page must never read this field, only
   * `status` — that's the actual meaning of "safe summarized" here.
   */
  detail: string;
  checkedAt: string;
};
