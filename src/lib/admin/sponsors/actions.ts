"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import { createClient } from "@/lib/supabase/server";
import { getSponsorSyncDispatchConfig, SPONSOR_SYNC_WORKFLOW_FILE } from "@/lib/admin/sponsors/dispatch-config";
import { SPONSOR_SYNC_STUCK_AFTER_MINUTES } from "@/lib/admin/sponsors/sync-state";

export type TriggerSponsorSyncResult = { error: string } | { success: string };

/**
 * "Run sync now": asks GitHub to dispatch the same workflow the daily schedule runs (see dispatch-config.ts for
 * why it isn't run in-process). It only *starts* the run — the import itself records its progress and outcome in
 * sponsor_imports, which is what the page then shows. Refuses if a run already looks in progress, so a double click
 * can't start two importers racing each other over the same ~130k rows.
 */
export async function triggerSponsorSync(): Promise<TriggerSponsorSyncResult> {
  const { user } = await requirePermission("manage_sponsor_sync");

  const config = getSponsorSyncDispatchConfig();
  if (!config) {
    return { error: "Manual sync isn't set up on this deployment (SPONSOR_SYNC_GITHUB_REPO / SPONSOR_SYNC_GITHUB_TOKEN)." };
  }

  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("sponsor_imports")
    .select("status, started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.status === "processing" && Date.now() - new Date(latest.started_at).getTime() < SPONSOR_SYNC_STUCK_AFTER_MINUTES * 60 * 1000) {
    return { error: "A sync is already running — wait for it to finish." };
  }

  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${config.repo}/actions/workflows/${SPONSOR_SYNC_WORKFLOW_FILE}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: config.ref }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { error: "Couldn't reach GitHub — try again." };
  }

  if (response.status !== 204) {
    console.error(`Sponsor sync dispatch failed [${response.status}]:`, (await response.text().catch(() => "")).slice(0, 300));
    return {
      error:
        response.status === 401 || response.status === 403 || response.status === 404
          ? "GitHub refused the request — check the token's access to this repository's workflows."
          : "GitHub couldn't start the sync — try again.",
    };
  }

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "sponsor_sync.trigger",
    entityType: "sponsor_sync",
    metadata: { repo: config.repo, ref: config.ref },
  });
  revalidatePath("/admin/sponsors");
  return { success: "Sync started — this page will show it as running within a minute." };
}
