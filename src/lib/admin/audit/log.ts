import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AuditEntityType =
  | "user"
  | "subscription"
  | "access_code"
  | "institution"
  | "institution_licence"
  | "institution_member"
  | "admin_role"
  | "admin_user_role"
  | "app_settings"
  | "sponsor_sync"
  | "test_prep"
  | "graduate_scheme"
  | "advice_guide"
  | "blog_post"
  | "comparison_page"
  | "lead";

/**
 * Call this *after* the real privileged action has already succeeded,
 * never before and never as part of the same check that gates it —
 * this is a record of what happened, not a guard. Best-effort by
 * design: a failed audit write is logged to the server console and
 * swallowed rather than thrown, so a logging hiccup can never turn an
 * admin's already-successful action (a user actually deleted, a role
 * actually granted) into a confusing error response. That trade-off —
 * occasional gaps over blocking real actions on telemetry — is a
 * deliberate choice for this app's current stage, not an oversight;
 * revisit if this ever needs to be a strict compliance guarantee.
 *
 * `metadata` must only ever hold values safe to retain indefinitely
 * and show to any admin with `view_audit_logs` — never a raw secret
 * (an invite token, a Stripe key, a password), matching the migration
 * 0079 table comment's own instruction. Each call site decides what's
 * safe for its own action; this function doesn't and can't enforce it.
 */
export async function logAdminAction(params: {
  actorId: string;
  actorEmail: string | null;
  action: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });
  if (error) {
    console.error(`logAdminAction failed for "${params.action}":`, error.message);
  }
}
