import "server-only";
import { hasFeature } from "@/lib/entitlements/service";

/** The job tracker is a plan feature (`job_tracker`); every write to it checks that on the server, whatever the UI shows. Returns the error to hand back, or null when allowed. */
export async function trackerBlocked(userId: string): Promise<{ error: string } | null> {
  return (await hasFeature(userId, "job_tracker")) ? null : { error: "The job tracker isn't included in your current plan." };
}
