import { describe, expect, it, vi } from "vitest";

const hasFeature = vi.fn();
vi.mock("@/lib/entitlements/service", () => ({ hasFeature: (...args: unknown[]) => hasFeature(...args) }));

import { trackerBlocked } from "@/lib/applications/access";

describe("trackerBlocked", () => {
  it("lets a plan with the job_tracker feature through", async () => {
    hasFeature.mockResolvedValueOnce(true);
    expect(await trackerBlocked("user-1")).toBeNull();
    expect(hasFeature).toHaveBeenCalledWith("user-1", "job_tracker");
  });
  it("refuses a plan without it, with a message the person can read", async () => {
    hasFeature.mockResolvedValueOnce(false);
    expect(await trackerBlocked("user-2")).toEqual({ error: "The job tracker isn't included in your current plan." });
  });
});
