import { describe, expect, it, vi } from "vitest";
import { stripLegalSuffixes, matchJobsToSponsors, matchJobToSponsor } from "@/lib/jobs/sponsor-match";
import type { SponsorRating } from "@/lib/sponsors/types";

type StubCall = { table: string; filters: { method: string; args: unknown[] }[] };
type StubResult = { data: unknown; error: unknown };

/**
 * A minimal, chainable stand-in for the real Supabase query builder.
 * Every filter method (`select`/`eq`/`in`/`ilike`/`limit`/`order`)
 * records itself and returns the same builder, so any chain shape
 * `sponsor-match.ts` uses resolves the same way; the actual data comes
 * from `resolve`, which sees the table name and the full recorded filter
 * chain so a test can distinguish e.g. a `.in("id", ...)` alias lookup
 * from a `.in("company_name_normalized", ...)` name lookup on the same
 * "sponsors" table without depending on call order.
 */
type RpcResolver = (name: string, args: Record<string, unknown>) => StubResult;

function createSupabaseStub(resolve: (call: StubCall) => StubResult, resolveRpc: RpcResolver = () => ({ data: [], error: null })) {
  return {
    // The stem tier is one RPC (migration 0101) — the register's row-level security made a per-stem ilike a full scan.
    rpc: (name: string, args: Record<string, unknown>) => Promise.resolve(resolveRpc(name, args)),
    from(table: string) {
      const filters: StubCall["filters"] = [];
      const builder: Record<string, (...args: never[]) => unknown> = {};
      const chain = (method: string) => (...args: unknown[]) => {
        filters.push({ method, args });
        return builder;
      };
      builder.select = chain("select");
      builder.eq = chain("eq");
      builder.in = chain("in");
      builder.ilike = chain("ilike");
      builder.limit = chain("limit");
      builder.order = chain("order");
      builder.maybeSingle = () => Promise.resolve(resolve({ table, filters }));
      builder.then = (onFulfilled: (value: StubResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(resolve({ table, filters })).then(onFulfilled, onRejected);
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function sponsorRow(overrides: Partial<{ id: string; company_name: string; town_city: string | null; rating: SponsorRating; company_name_normalized: string }>) {
  return {
    id: "sponsor-1",
    company_name: "Acme Ltd",
    town_city: "London",
    rating: "a_rating" as SponsorRating,
    company_name_normalized: "acme ltd",
    ...overrides,
  };
}

async function withStub(resolve: (call: StubCall) => StubResult, run: () => Promise<void>, resolveRpc?: RpcResolver) {
  const { createClient } = await import("@/lib/supabase/server");
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(createSupabaseStub(resolve, resolveRpc));
  await run();
}

describe("stripLegalSuffixes", () => {
  it("strips a single trailing legal suffix", () => {
    expect(stripLegalSuffixes("acme ltd")).toBe("acme");
    expect(stripLegalSuffixes("acme limited")).toBe("acme");
  });

  it("strips multiple trailing legal suffixes in one pass", () => {
    expect(stripLegalSuffixes("acme holdings group ltd")).toBe("acme");
  });

  it("does not strip a suffix that is only a substring of the last word", () => {
    // "cisco" ends in the letters "co" but is not the whole word "co".
    expect(stripLegalSuffixes("bright cisco")).toBe("bright cisco");
  });

  it("never reduces a name down to nothing, even if every word looks like a suffix", () => {
    expect(stripLegalSuffixes("group ltd")).toBe("group");
  });

  it("leaves a name with no legal suffix unchanged", () => {
    expect(stripLegalSuffixes("bright path consulting")).toBe("bright path consulting");
  });

  it("strips trailing punctuation on the suffix itself before matching", () => {
    expect(stripLegalSuffixes("acme ltd.")).toBe("acme");
  });
});

describe("matchJobsToSponsors", () => {
  it("returns an empty map for an empty or all-blank input without querying anything", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
    mockedCreateClient.mockClear();

    const result = await matchJobsToSponsors(["", "   "]);
    expect(result.size).toBe(0);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("returns confirmed_sponsor/exact for a single unambiguous exact name match", async () => {
    await withStub(
      ({ table, filters }) => {
        if (table === "sponsors" && filters.some((f) => f.method === "in" && f.args[0] === "company_name_normalized")) {
          return { data: [sponsorRow({})], error: null };
        }
        return { data: [], error: null };
      },
      async () => {
        const result = await matchJobsToSponsors(["Acme Ltd"]);
        const match = result.get("Acme Ltd");
        expect(match?.status).toBe("confirmed_sponsor");
        expect(match?.confidence).toBe("exact");
        expect(match?.sponsors).toHaveLength(1);
        expect(match?.sponsors[0].matchedVia).toBe("name");
      },
    );
  });

  it("returns unconfirmed/ambiguous when the same normalized key resolves to two distinct real companies", async () => {
    await withStub(
      ({ table, filters }) => {
        if (table === "sponsors" && filters.some((f) => f.method === "in" && f.args[0] === "company_name_normalized")) {
          return { data: [sponsorRow({ id: "s1", company_name: "Acme Ltd", company_name_normalized: "acme ltd" })], error: null };
        }
        if (table === "sponsor_aliases") {
          return { data: [{ sponsor_id: "s2", alias_name_normalized: "acme ltd" }], error: null };
        }
        if (table === "sponsors" && filters.some((f) => f.method === "in" && f.args[0] === "id")) {
          return { data: [sponsorRow({ id: "s2", company_name: "Different Co", company_name_normalized: "different co" })], error: null };
        }
        return { data: [], error: null };
      },
      async () => {
        const result = await matchJobsToSponsors(["Acme Ltd"]);
        const match = result.get("Acme Ltd");
        expect(match?.status).toBe("unconfirmed");
        expect(match?.confidence).toBe("ambiguous");
        expect(match?.sponsors).toHaveLength(2);
      },
    );
  });

  it("falls back to a stem match (likely) only when Tier 1 found nothing", async () => {
    await withStub(
      () => ({ data: [], error: null }),
      async () => {
        const result = await matchJobsToSponsors(["Acme Consulting Ltd"]);
        const match = result.get("Acme Consulting Ltd");
        expect(match?.status).toBe("unconfirmed");
        expect(match?.confidence).toBe("likely");
      },
      (name, args) => {
        expect(name).toBe("sponsor_stem_candidates");
        expect(args.p_stems).toEqual(["acme consulting"]);
        // A prefix candidate that isn't the same company once its own suffix is stripped must be ignored.
        return {
          data: [
            { stem: "acme consulting", ...sponsorRow({ id: "s1", company_name: "Acme Consulting Group", company_name_normalized: "acme consulting group" }) },
            { stem: "acme consulting", ...sponsorRow({ id: "s2", company_name: "Acme Consulting Partners", company_name_normalized: "acme consulting partners" }) },
          ],
          error: null,
        };
      },
    );
  });

  it("does not use the stem tier for a name Tier 1 already resolved exactly", async () => {
    const rpc = vi.fn(() => ({ data: [], error: null }));
    await withStub(
      ({ table, filters }) =>
        table === "sponsors" && filters.some((f) => f.method === "in" && f.args[0] === "company_name_normalized")
          ? { data: [sponsorRow({})], error: null }
          : { data: [], error: null },
      async () => {
        const result = await matchJobsToSponsors(["Acme Ltd"]);
        expect(result.get("Acme Ltd")?.confidence).toBe("exact");
        expect(rpc).not.toHaveBeenCalled();
      },
      rpc,
    );
  });

  it("throws when the register can't be queried, instead of reporting the employer as not found", async () => {
    await withStub(
      () => ({ data: null, error: { message: "canceling statement due to statement timeout" } }),
      async () => {
        await expect(matchJobsToSponsors(["Acme Ltd"])).rejects.toThrow(/Sponsor cross-check failed/);
      },
    );
    await withStub(
      () => ({ data: [], error: null }),
      async () => {
        await expect(matchJobsToSponsors(["Acme Consulting Ltd"])).rejects.toThrow(/Sponsor cross-check failed/);
      },
      () => ({ data: null, error: { message: "timeout" } }),
    );
  });

  it("returns not_found with an empty sponsors list when nothing matches at all", async () => {
    await withStub(
      () => ({ data: [], error: null }),
      async () => {
        const result = await matchJobsToSponsors(["Totally Unknown Employer"]);
        const match = result.get("Totally Unknown Employer");
        expect(match?.status).toBe("not_found");
        expect(match?.confidence).toBe("none");
        expect(match?.sponsors).toEqual([]);
      },
    );
  });

  it("de-duplicates input names before querying but still returns a result for every original name", async () => {
    await withStub(
      () => ({ data: [], error: null }),
      async () => {
        const result = await matchJobsToSponsors(["Acme", "Acme", " Acme "]);
        expect(result.size).toBe(1);
        expect(result.get("Acme")?.status).toBe("not_found");
      },
    );
  });
});

describe("matchJobToSponsor", () => {
  it("is a single-company convenience wrapper that trims the input the same way the batch function keys its results", async () => {
    await withStub(
      ({ table, filters }) => {
        if (table === "sponsors" && filters.some((f) => f.method === "in" && f.args[0] === "company_name_normalized")) {
          return { data: [sponsorRow({})], error: null };
        }
        return { data: [], error: null };
      },
      async () => {
        const match = await matchJobToSponsor("  Acme Ltd  ");
        expect(match.status).toBe("confirmed_sponsor");
      },
    );
  });
});
