import type { Role } from "@/server/db/schema/enums";

export const PERMISSIONS = {
  "orders.view": "View orders and the order queue",
  "orders.approve": "Approve paid orders",
  "orders.update_status": "Move orders through the kitchen workflow",
  "orders.modify": "Modify order items and customer details",
  "menu.availability": "Toggle product availability for own branch",
  "menu.manage": "Create and edit categories, products, prices and options",
  "branches.manage": "Edit branch details, hours and ordering settings",
  "staff.manage": "Create, edit, suspend staff and set permissions",
  "analytics.view": "View sales analytics",
  "reports.export": "Export PDF and Excel reports",
  "notifications.view": "Receive operational notifications",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export type StaffRole = Exclude<Role, "CUSTOMER">;

const CASHIER: Permission[] = [
  "orders.view",
  "orders.approve",
  "orders.update_status",
  "notifications.view",
];
const BRANCH_MANAGER: Permission[] = [
  ...CASHIER,
  "orders.modify",
  "menu.availability",
  "analytics.view",
  "reports.export",
];
const CENTRAL_MANAGER: Permission[] = [...BRANCH_MANAGER, "menu.manage"];

export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRole, Permission[]> = {
  CASHIER,
  BRANCH_MANAGER,
  CENTRAL_MANAGER,
  CEO: ALL_PERMISSIONS,
};

/** Roles whose access is company-wide rather than tied to assigned branches. */
export const ALL_BRANCH_ROLES: StaffRole[] = ["CENTRAL_MANAGER", "CEO"];

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: "Customer",
  CASHIER: "Cashier",
  BRANCH_MANAGER: "Branch Manager",
  CENTRAL_MANAGER: "Central Manager",
  CEO: "CEO",
};

export function isStaffRole(role: string): role is StaffRole {
  return role === "CASHIER" || role === "BRANCH_MANAGER" || role === "CENTRAL_MANAGER" || role === "CEO";
}

/** Pure resolution of effective permissions: role defaults + per-user overrides. CEO always has everything. */
export function resolvePermissions(
  role: StaffRole,
  overrides: { permissionKey: string; granted: boolean }[],
): Set<Permission> {
  const set = new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[role]);
  if (role === "CEO") return set;
  for (const o of overrides) {
    if (!(o.permissionKey in PERMISSIONS)) continue;
    if (o.granted) set.add(o.permissionKey as Permission);
    else set.delete(o.permissionKey as Permission);
  }
  return set;
}

export type StaffContext = {
  userId: string;
  name: string;
  email: string;
  role: StaffRole;
  permissions: Set<Permission>;
  /** null = all branches */
  branchIds: string[] | null;
};

export function canAccessBranch(ctx: Pick<StaffContext, "branchIds">, branchId: string): boolean {
  return ctx.branchIds === null || ctx.branchIds.includes(branchId);
}

export function hasPermission(ctx: StaffContext, perm: Permission, branchId?: string | null): boolean {
  if (!ctx.permissions.has(perm)) return false;
  if (branchId && !canAccessBranch(ctx, branchId)) return false;
  return true;
}
