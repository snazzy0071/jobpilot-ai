import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTION_ADAPTERS } from "@/lib/auto-apply/adapters/registry";

const num = z.coerce.number().catch(0);
const counts = z.record(z.string(), num);
const schema = z.object({
  users_with_settings: num,
  enabled: num,
  paused: num,
  consented: num,
  users_with_queue: num,
  queue_by_status: counts,
  queued_30d: num,
  approved_30d: num,
  applied_30d: num,
  by_adapter: counts,
  events_7d: counts,
});

export type AutoApplyAdminData = {
  usersWithSettings: number;
  enabled: number;
  paused: number;
  consented: number;
  usersWithQueue: number;
  queueByStatus: Record<string, number>;
  queued30d: number;
  approved30d: number;
  applied30d: number;
  byAdapter: Record<string, number>;
  events7d: Record<string, number>;
  /** From the code, not the database: which adapters this deployment ships and whether any can submit. */
  adapters: { id: string; label: string; canSubmit: boolean }[];
};

/** Aggregate counts only (migration 0122): no user, job, CV or cover letter is ever returned to the admin. Null when the query fails — never shown as zeros. */
export async function getAutoApplyAdminData(): Promise<AutoApplyAdminData | null> {
  const { data, error } = await createAdminClient().rpc("admin_auto_apply_overview");
  if (error) {
    console.error("admin_auto_apply_overview failed:", error.message);
    return null;
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) return null;
  const d = parsed.data;
  return {
    usersWithSettings: d.users_with_settings,
    enabled: d.enabled,
    paused: d.paused,
    consented: d.consented,
    usersWithQueue: d.users_with_queue,
    queueByStatus: d.queue_by_status,
    queued30d: d.queued_30d,
    approved30d: d.approved_30d,
    applied30d: d.applied_30d,
    byAdapter: d.by_adapter,
    events7d: d.events_7d,
    adapters: PRODUCTION_ADAPTERS.map((adapter) => ({ id: adapter.id, label: adapter.label, canSubmit: adapter.canSubmit })),
  };
}
