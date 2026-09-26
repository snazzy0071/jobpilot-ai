import { describe, expect, it } from "vitest";
import { wouldRemoveLastRoleManager, type AssignmentRow } from "@/lib/admin/roles/lockout";

const manager = (id: string, roleId = "r-super", active = true): AssignmentRow => ({ id, admin_role_id: roleId, admin_roles: { permissions: ["manage_admin_roles", "view_leads"], is_active: active } });
const other = (id: string): AssignmentRow => ({ id, admin_role_id: "r-leads", admin_roles: { permissions: ["view_leads"], is_active: true } });

describe("wouldRemoveLastRoleManager", () => {
  it("blocks revoking the only assignment that can manage roles", () => {
    expect(wouldRemoveLastRoleManager([manager("a"), other("b")], (row) => row.id === "a")).toBe(true);
  });
  it("allows it while another active assignment can", () => {
    expect(wouldRemoveLastRoleManager([manager("a"), manager("b")], (row) => row.id === "a")).toBe(false);
  });
  it("does not count an inactive role as a way back in", () => {
    expect(wouldRemoveLastRoleManager([manager("a"), manager("b", "r-old", false)], (row) => row.id === "a")).toBe(true);
  });
  it("works per role too: editing or deleting the last role that grants it is refused, another role that grants it makes it fine", () => {
    expect(wouldRemoveLastRoleManager([manager("a"), manager("b")], (row) => row.admin_role_id === "r-super")).toBe(true);
    expect(wouldRemoveLastRoleManager([manager("a"), manager("b", "r-second")], (row) => row.admin_role_id === "r-super")).toBe(false);
  });
  it("reads the role whether the database returns it as an object or a one-element list, and copes with none", () => {
    const listed: AssignmentRow = { id: "c", admin_roles: [{ permissions: ["manage_admin_roles"], is_active: true }] };
    expect(wouldRemoveLastRoleManager([listed], () => false)).toBe(false);
    expect(wouldRemoveLastRoleManager([{ id: "d", admin_roles: null }], () => false)).toBe(true);
    expect(wouldRemoveLastRoleManager([], () => false)).toBe(true);
  });
});
