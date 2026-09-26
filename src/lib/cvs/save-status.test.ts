import { describe, expect, it } from "vitest";
import { carryRowId, deriveOverallStatus, dropEndDateWhenOngoing } from "@/lib/cvs/save-status";

describe("deriveOverallStatus", () => {
  it("is idle before anything has been saved", () => {
    expect(deriveOverallStatus([])).toEqual({ status: "idle", message: null });
    expect(deriveOverallStatus([{ status: "idle", message: null }])).toEqual({ status: "idle", message: null });
  });

  it("is saved once something saved and nothing is pending or failing", () => {
    expect(deriveOverallStatus([{ status: "saved", message: null }, { status: "idle", message: null }]).status).toBe("saved");
  });

  it("shows saving while any source is saving, even if another has an old error", () => {
    const result = deriveOverallStatus([
      { status: "error", message: "old failure" },
      { status: "saving", message: null },
    ]);
    expect(result.status).toBe("saving");
  });

  it("never hides an error behind a later success elsewhere", () => {
    const result = deriveOverallStatus([
      { status: "saved", message: null },
      { status: "error", message: "Couldn't save that role — try again." },
    ]);
    expect(result).toEqual({ status: "error", message: "Couldn't save that role — try again." });
  });
});

describe("carryRowId", () => {
  it("stamps the id of the row the first save created onto a snapshot taken before it came back", () => {
    const pending = new FormData();
    pending.set("jobTitle", "Engineer");
    expect(carryRowId(pending, "row-1").get("id")).toBe("row-1");
  });

  it("stamps it over an empty id field (the hidden input of a not-yet-saved row)", () => {
    const pending = new FormData();
    pending.set("id", "");
    expect(carryRowId(pending, "row-1").get("id")).toBe("row-1");
  });

  it("never overwrites an id that is already there", () => {
    const pending = new FormData();
    pending.set("id", "row-existing");
    expect(carryRowId(pending, "row-other").get("id")).toBe("row-existing");
  });

  it("does nothing when no row has been created yet", () => {
    const pending = new FormData();
    expect(carryRowId(pending, null).get("id")).toBeNull();
  });
});

describe("dropEndDateWhenOngoing", () => {
  it("removes the end date from a snapshot whose current/ongoing box is ticked (the server rejects both together)", () => {
    for (const flag of ["isCurrent", "isOngoing"] as const) {
      const snapshot = new FormData();
      snapshot.set("endDate", "2021-02-01");
      snapshot.set(flag, "on");
      const result = dropEndDateWhenOngoing(snapshot, flag);
      expect(result.get("endDate")).toBeNull();
      expect(result.get(flag)).toBe("on");
    }
  });

  it("keeps the end date when the box is unticked or absent", () => {
    const off = new FormData();
    off.set("endDate", "2021-02-01");
    off.set("isCurrent", "off");
    expect(dropEndDateWhenOngoing(off, "isCurrent").get("endDate")).toBe("2021-02-01");

    const absent = new FormData();
    absent.set("endDate", "2021-02-01");
    expect(dropEndDateWhenOngoing(absent, "isOngoing").get("endDate")).toBe("2021-02-01");
  });
});
