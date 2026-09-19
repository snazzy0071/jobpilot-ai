import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(async () => ({ id: "user-1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/cvs/queries", () => ({ getCvEditorData: vi.fn() }));
vi.mock("@/lib/entitlements/service", () => ({
  requireUsageAllowed: vi.fn(),
  releaseUsage: vi.fn(),
  EntitlementError: class EntitlementError extends Error {},
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const CV_ID = "11111111-1111-4111-8111-111111111111";

function form(template: string) {
  const data = new FormData();
  data.set("cvId", CV_ID);
  data.set("template", template);
  return data;
}

/** A supabase stub for `.from("cvs").update(...).eq().eq().select()` that records the update and answers as configured. */
function stubUpdate(answer: { data: { id: string }[] | null; error: { code?: string; message: string } | null }) {
  const calls: { patch?: unknown; filters: [string, unknown][] } = { filters: [] };
  const builder = {
    update(patch: unknown) {
      calls.patch = patch;
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.filters.push([column, value]);
      return builder;
    },
    select: async () => answer,
  };
  return { client: { from: () => builder }, calls };
}

describe("updateCvTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("saves the template on the owner's CV and refreshes both the list and the editor page", async () => {
    const { client, calls } = stubUpdate({ data: [{ id: CV_ID }], error: null });
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(client as never);
    const { revalidatePath } = await import("next/cache");
    const { updateCvTemplate } = await import("@/lib/cvs/actions");

    expect(await updateCvTemplate(undefined, form("sovereign"))).toEqual({ success: "Template updated." });

    expect(calls.patch).toEqual({ template: "sovereign" });
    expect(calls.filters).toEqual([
      ["id", CV_ID],
      ["user_id", "user-1"],
    ]);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/dashboard/cvs");
    // The editor page itself, so its server-rendered template name and preview data can't stay stale.
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/dashboard/cvs/${CV_ID}`);
  });

  it("reports an update that matched no row instead of claiming success", async () => {
    const { client } = stubUpdate({ data: [], error: null });
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(client as never);
    const { updateCvTemplate } = await import("@/lib/cvs/actions");

    expect(await updateCvTemplate(undefined, form("sovereign"))).toEqual({ error: "That CV couldn't be found." });
  });

  it("explains the missing-migration case (the database's enum doesn't know this template yet)", async () => {
    const { client } = stubUpdate({ data: null, error: { code: "22P02", message: 'invalid input value for enum cv_template: "sovereign"' } });
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(client as never);
    const { revalidatePath } = await import("next/cache");
    const { updateCvTemplate } = await import("@/lib/cvs/actions");

    const result = await updateCvTemplate(undefined, form("sovereign"));
    expect(result).toEqual({ error: expect.stringContaining("isn't available on the server yet") });
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });

  it("returns a generic error for any other database failure", async () => {
    const { client } = stubUpdate({ data: null, error: { code: "XX000", message: "boom" } });
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(client as never);
    const { updateCvTemplate } = await import("@/lib/cvs/actions");

    expect(await updateCvTemplate(undefined, form("sovereign"))).toEqual({ error: "Couldn't save the template — try again." });
  });

  it("rejects a template that isn't in the catalog before touching the database", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { updateCvTemplate } = await import("@/lib/cvs/actions");

    expect(await updateCvTemplate(undefined, form("not-a-template"))).toEqual({ error: "Invalid request." });
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });
});
