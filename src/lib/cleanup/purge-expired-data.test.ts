import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import {
  CAMPUS_CREW_RETENTION_DAYS,
  UNCONFIRMED_NEWSLETTER_RETENTION_DAYS,
  purgeExpiredInstitutionInvites,
  purgeOldCampusCrewApplications,
  purgeOldEmailSendLogs,
  purgeResolvedWebhookFailures,
  purgeStaleAiRateLimitWindows,
  purgeStaleAnonymousRateLimits,
  purgeUnconfirmedNewsletterSignups,
} from "@/lib/cleanup/purge-expired-data";

type Call = { method: string; args: unknown[] };

/** A stand-in for the Supabase client that records the delete query it is asked to run and answers with the given rows or error. */
function fakeClient(result: { data?: { id: string }[]; error?: { message: string } }) {
  const calls: Call[] = [];
  let table = "";
  const chain: Record<string, unknown> = {};
  for (const method of ["delete", "lt", "eq", "is", "not"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.select = (...args: unknown[]) => {
    calls.push({ method: "select", args });
    return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
  };
  const client = {
    from: (name: string) => {
      table = name;
      return chain;
    },
  };
  return { client: client as never, calls, table: () => table };
}

const DAY = 86_400_000;
const cutoffOf = (calls: Call[]) => new Date(calls.find((call) => call.method === "lt")!.args[1] as string).getTime();
const daysAgo = (calls: Call[]) => Math.round((Date.now() - cutoffOf(calls)) / DAY);

describe("retention sweeps", () => {
  it("unconfirmed newsletter signups: only pending rows, older than the window", async () => {
    const { client, calls, table } = fakeClient({ data: [{ id: "1" }, { id: "2" }] });
    expect(await purgeUnconfirmedNewsletterSignups(client)).toBe(2);
    expect(table()).toBe("newsletter_subscribers");
    expect(calls).toContainEqual({ method: "eq", args: ["status", "pending"] });
    expect(calls.find((call) => call.method === "lt")!.args[0]).toBe("confirmation_sent_at");
    expect(daysAgo(calls)).toBe(UNCONFIRMED_NEWSLETTER_RETENTION_DAYS);
  });

  it("campus crew applications: by age only", async () => {
    const { client, calls, table } = fakeClient({ data: [] });
    expect(await purgeOldCampusCrewApplications(client)).toBe(0);
    expect(table()).toBe("campus_crew_applications");
    expect(calls.find((call) => call.method === "lt")!.args[0]).toBe("created_at");
    expect(daysAgo(calls)).toBe(CAMPUS_CREW_RETENTION_DAYS);
  });

  it("email logs (400 days), rate limit windows (35 and 7 days) and webhook failures (resolved only, 90 days)", async () => {
    const email = fakeClient({ data: [{ id: "a" }] });
    expect(await purgeOldEmailSendLogs(email.client)).toBe(1);
    expect(daysAgo(email.calls)).toBe(400);

    const anonymous = fakeClient({ data: [] });
    await purgeStaleAnonymousRateLimits(anonymous.client);
    expect(daysAgo(anonymous.calls)).toBe(35);

    const ai = fakeClient({ data: [] });
    await purgeStaleAiRateLimitWindows(ai.client);
    expect(daysAgo(ai.calls)).toBe(7);

    const webhook = fakeClient({ data: [] });
    await purgeResolvedWebhookFailures(webhook.client);
    expect(webhook.calls).toContainEqual({ method: "not", args: ["resolved_at", "is", null] });
    expect(daysAgo(webhook.calls)).toBe(90);
  });

  it("institution invites: only expired ones that were never accepted", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "i" }] });
    expect(await purgeExpiredInstitutionInvites(client)).toBe(1);
    expect(calls).toContainEqual({ method: "is", args: ["accepted_at", null] });
    expect(calls.find((call) => call.method === "lt")!.args[0]).toBe("expires_at");
  });

  it("a database error is thrown with its reason, so the sweep reports it instead of hiding it", async () => {
    const { client } = fakeClient({ error: { message: "boom" } });
    await expect(purgeUnconfirmedNewsletterSignups(client)).rejects.toThrow("Couldn't purge unconfirmed newsletter signups: boom");
  });
});
