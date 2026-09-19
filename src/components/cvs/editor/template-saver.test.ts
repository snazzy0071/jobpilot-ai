import { describe, expect, it, vi } from "vitest";
import { createTemplateSaver } from "@/components/cvs/editor/template-saver";

type T = "a" | "b" | "c";

function deferred<V>() {
  let resolve!: (value: V) => void;
  const promise = new Promise<V>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(persist: (t: T) => Promise<{ error: string } | null>) {
  const shown: T[] = [];
  const reverts: { to: T; message: string }[] = [];
  const statuses: string[] = [];
  const saver = createTemplateSaver<T>({
    initial: "a",
    persist,
    onOptimistic: (t) => shown.push(t),
    onRevert: (to, message) => reverts.push({ to, message }),
    onStatus: (status) => statuses.push(status),
  });
  return { saver, shown, reverts, statuses };
}

describe("createTemplateSaver", () => {
  it("shows the new template immediately, before the save has finished", async () => {
    const gate = deferred<null>();
    const { saver, shown } = setup(() => gate.promise);
    saver.select("b");
    expect(shown).toEqual(["b"]);
    expect(saver.persisted()).toBe("a"); // not persisted yet
    gate.resolve(null);
    await saver.whenIdle();
    expect(saver.persisted()).toBe("b");
  });

  it("persists A → B → C in order and ends on the last choice, without a save per intermediate step", async () => {
    const persisted: T[] = [];
    const gates = [deferred<null>(), deferred<null>()];
    let call = 0;
    const { saver } = setup(async (t) => {
      persisted.push(t);
      return gates[call++].promise;
    });
    saver.select("b");
    saver.select("c"); // arrives while B is still being saved
    gates[0].resolve(null);
    await Promise.resolve();
    gates[1].resolve(null);
    await saver.whenIdle();
    expect(persisted).toEqual(["b", "c"]); // never out of order
    expect(saver.persisted()).toBe("c");
  });

  it("never persists a template that was replaced before its turn came", async () => {
    const persisted: T[] = [];
    const gate = deferred<null>();
    let first = true;
    const { saver } = setup(async (t) => {
      persisted.push(t);
      if (first) {
        first = false;
        return gate.promise;
      }
      return null;
    });
    saver.select("b");
    saver.select("c");
    saver.select("a"); // back to where we started, while B is still in flight
    gate.resolve(null);
    await saver.whenIdle();
    expect(saver.persisted()).toBe("a");
    expect(persisted[persisted.length - 1]).toBe("a");
  });

  it("reverts the preview to the last persisted template and surfaces the error when a save fails", async () => {
    const { saver, reverts, statuses } = setup(async () => ({ error: "Couldn't update the template." }));
    saver.select("b");
    const result = await saver.whenIdle();
    expect(result).toEqual({ error: "Couldn't update the template." });
    expect(reverts).toEqual([{ to: "a", message: "Couldn't update the template." }]);
    expect(saver.persisted()).toBe("a");
    expect(statuses).toContain("error");
    expect(statuses).not.toContain("saved");
  });

  it("treats a thrown/rejected save as an error too, never as a hang", async () => {
    const { saver, reverts } = setup(() => Promise.reject(new Error("network down")));
    saver.select("b");
    const result = await saver.whenIdle();
    expect(result).toEqual({ error: "network down" });
    expect(reverts[0].to).toBe("a");
  });

  it("carries on with a newer choice when an older in-flight save fails", async () => {
    const persisted: T[] = [];
    const gate = deferred<{ error: string } | null>();
    let first = true;
    const { saver, reverts } = setup(async (t) => {
      persisted.push(t);
      if (first) {
        first = false;
        return gate.promise;
      }
      return null;
    });
    saver.select("b");
    saver.select("c");
    gate.resolve({ error: "boom" }); // B fails, but the user has already moved on to C
    await saver.whenIdle();
    expect(persisted).toEqual(["b", "c"]);
    expect(saver.persisted()).toBe("c");
    expect(reverts).toEqual([]); // nothing to revert: the latest choice was saved
  });

  it("whenIdle resolves immediately when nothing is pending", async () => {
    const persist = vi.fn();
    const { saver } = setup(persist);
    expect(await saver.whenIdle()).toBeNull();
    expect(persist).not.toHaveBeenCalled();
  });

  it("does not save when the chosen template is already the persisted one", async () => {
    const persist = vi.fn(async () => null);
    const { saver } = setup(persist);
    saver.select("a");
    await saver.whenIdle();
    expect(persist).not.toHaveBeenCalled();
  });
});
