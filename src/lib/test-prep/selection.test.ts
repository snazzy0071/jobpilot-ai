import { describe, expect, it } from "vitest";
import { orderByPriority, pickDaily, pickFocus, priorityTier, type Candidate, type QuestionHistory } from "@/lib/test-prep/selection";

const noRandom = () => 0.5;
const c = (id: string, testTypeId: string, subtype: string | null = null): Candidate => ({ id, testTypeId, subtype });
const seen = (correct: boolean, at: string): QuestionHistory => ({ lastCorrect: correct, lastAnsweredAt: at });

describe("priorityTier", () => {
  it("ranks never-seen ahead of wrong ahead of right", () => {
    expect(priorityTier(undefined)).toBe(0);
    expect(priorityTier(seen(false, "2026-01-01"))).toBe(1);
    expect(priorityTier(seen(true, "2026-01-01"))).toBe(2);
  });
});

describe("orderByPriority", () => {
  it("serves unseen, then missed, then answered-longest-ago", () => {
    const list = [c("right-new", "t"), c("right-old", "t"), c("wrong", "t"), c("unseen", "t")];
    const histories = new Map([
      ["right-new", seen(true, "2026-03-01T00:00:00Z")],
      ["right-old", seen(true, "2026-01-01T00:00:00Z")],
      ["wrong", seen(false, "2026-03-01T00:00:00Z")],
    ]);
    expect(orderByPriority(list, histories, new Set(), noRandom).map((x) => x.id)).toEqual(["unseen", "wrong", "right-old", "right-new"]);
  });

  it("prefers weak topics within a tier", () => {
    const list = [c("a", "t", "Strong"), c("b", "t", "Weak")];
    expect(orderByPriority(list, new Map(), new Set(["Weak"]), noRandom).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("does not mutate its input", () => {
    const list = [c("a", "t"), c("b", "t")];
    orderByPriority(list, new Map([["a", seen(true, "2026-01-01")]]), new Set(), noRandom);
    expect(list.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("pickDaily", () => {
  const pool = [c("n1", "num"), c("n2", "num"), c("v1", "verbal"), c("d1", "diag"), c("s1", "sjt"), c("w1", "wg"), c("w2", "wg")];

  it("takes one question from each test type", () => {
    const picked = pickDaily(pool, new Map(), new Set(), 5, noRandom);
    expect(picked).toHaveLength(5);
    const types = new Set(picked.map((id) => pool.find((p) => p.id === id)!.testTypeId));
    expect(types.size).toBe(5);
  });

  it("fills the gap from the best remaining questions when there are fewer types than slots", () => {
    const small = [c("a1", "a"), c("a2", "a"), c("b1", "b")];
    const picked = pickDaily(small, new Map(), new Set(), 3, noRandom);
    expect([...picked].sort()).toEqual(["a1", "a2", "b1"]);
  });

  it("never returns more than the pool has or the requested size", () => {
    expect(pickDaily([c("x", "a")], new Map(), new Set(), 5, noRandom)).toEqual(["x"]);
    expect(pickDaily(pool, new Map(), new Set(), 3, noRandom)).toHaveLength(3);
  });

  it("prefers the question a learner got wrong within a type", () => {
    const histories = new Map([["n1", seen(true, "2026-01-01")], ["n2", seen(false, "2026-01-01")]]);
    const picked = pickDaily([c("n1", "num"), c("n2", "num")], histories, new Set(), 1, noRandom);
    expect(picked).toEqual(["n2"]);
  });

  it("returns nothing for an empty pool", () => {
    expect(pickDaily([], new Map(), new Set())).toEqual([]);
  });
});

describe("pickFocus", () => {
  it("returns the best `size` questions", () => {
    const list = [c("a", "t"), c("b", "t"), c("c", "t")];
    const histories = new Map([["a", seen(true, "2026-01-01")]]);
    const picked = pickFocus(list, histories, 2, noRandom);
    expect(picked).toHaveLength(2);
    expect(picked).not.toContain("a");
  });
});
