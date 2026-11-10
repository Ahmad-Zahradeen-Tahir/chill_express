import { describe, expect, it } from "vitest";
import { hasPermission, resolvePermissions, type StaffContext } from "@/server/auth/permissions";

const GR = "branch-gombole";
const LS = "branch-lagos";
const ctx = (role: StaffContext["role"], branchIds: string[] | null, overrides: { permissionKey: string; granted: boolean }[] = []): StaffContext => ({
  userId: "u", name: "n", email: "e", role, branchIds, permissions: resolvePermissions(role, overrides),
});

describe("permissions", () => {
  it("Gombole Road cashier cannot act on Lagos Street", () => {
    const c = ctx("CASHIER", [GR]);
    expect(hasPermission(c, "orders.approve", GR)).toBe(true);
    expect(hasPermission(c, "orders.approve", LS)).toBe(false);
  });
  it("cashier cannot modify, manage menu or staff", () => {
    const c = ctx("CASHIER", [GR]);
    for (const p of ["orders.modify", "menu.manage", "staff.manage", "analytics.view"] as const) {
      expect(hasPermission(c, p, GR)).toBe(false);
    }
  });
  it("branch manager limited to own branch; central manager and CEO everywhere", () => {
    expect(hasPermission(ctx("BRANCH_MANAGER", [LS]), "orders.modify", GR)).toBe(false);
    expect(hasPermission(ctx("CENTRAL_MANAGER", null), "orders.modify", GR)).toBe(true);
    expect(hasPermission(ctx("CEO", null), "staff.manage", LS)).toBe(true);
    expect(hasPermission(ctx("CENTRAL_MANAGER", null), "staff.manage")).toBe(false);
  });
  it("overrides grant and revoke, but never reduce the CEO", () => {
    const c = ctx("CASHIER", [GR], [{ permissionKey: "orders.modify", granted: true }, { permissionKey: "orders.approve", granted: false }]);
    expect(hasPermission(c, "orders.modify", GR)).toBe(true);
    expect(hasPermission(c, "orders.approve", GR)).toBe(false);
    const ceo = ctx("CEO", null, [{ permissionKey: "staff.manage", granted: false }]);
    expect(hasPermission(ceo, "staff.manage")).toBe(true);
  });
  it("staff with no branches can access nothing branch-scoped", () => {
    expect(hasPermission(ctx("CASHIER", []), "orders.view", GR)).toBe(false);
  });
});
