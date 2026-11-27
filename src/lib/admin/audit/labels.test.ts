import { describe, expect, it } from "vitest";
import { describeAdminAction, describeAdminEntity } from "@/lib/admin/audit/labels";

describe("admin audit labels", () => {
  it("turns known action codes into plain English", () => {
    expect(describeAdminAction("user.delete")).toBe("Deleted a user");
    expect(describeAdminAction("subscription.cancel")).toBe("Cancelled a subscription");
    expect(describeAdminEntity("user")).toBe("Users");
  });

  it("never shows a raw code for an action it doesn't know", () => {
    expect(describeAdminAction("widget.bulk_archive")).toBe("Widget bulk archive");
    expect(describeAdminEntity("some_new_thing")).toBe("Some new thing");
  });
});
