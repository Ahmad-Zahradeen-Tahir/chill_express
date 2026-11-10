import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { staffBranch, user, userPermissionOverride } from "@/server/db/schema";
import { auth } from "./auth";
import {
  ALL_BRANCH_ROLES,
  canAccessBranch,
  isStaffRole,
  resolvePermissions,
  type Permission,
  type StaffContext,
} from "./permissions";

export class AuthzError extends Error {
  constructor(
    message: string,
    public code: "UNAUTHENTICATED" | "FORBIDDEN" = "FORBIDDEN",
  ) {
    super(message);
  }
}

/** Current session (or null). Cached per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export const getCurrentUser = cache(async () => {
  const s = await getSession();
  if (!s) return null;
  // Always re-read role/status from the DB; never trust session snapshots for authorization.
  const u = await db.query.user.findFirst({ where: eq(user.id, s.user.id) });
  if (!u || u.status !== "ACTIVE") return null;
  return u;
});

export async function loadStaffContext(userId: string): Promise<StaffContext | null> {
  const u = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!u || u.status !== "ACTIVE" || !isStaffRole(u.role)) return null;
  const overrides = await db
    .select({ permissionKey: userPermissionOverride.permissionKey, granted: userPermissionOverride.granted })
    .from(userPermissionOverride)
    .where(eq(userPermissionOverride.userId, u.id));
  let branchIds: string[] | null = null;
  if (!ALL_BRANCH_ROLES.includes(u.role)) {
    const rows = await db.select({ branchId: staffBranch.branchId }).from(staffBranch).where(eq(staffBranch.userId, u.id));
    branchIds = rows.map((r) => r.branchId);
  }
  return {
    userId: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    permissions: resolvePermissions(u.role, overrides),
    branchIds,
  };
}

/** Staff context for the current request, or null. */
export const getStaff = cache(async (): Promise<StaffContext | null> => {
  const s = await getSession();
  if (!s) return null;
  return loadStaffContext(s.user.id);
});

/** For server actions / route handlers: throws AuthzError. Branch is checked when provided. */
export async function requirePermission(perm: Permission, opts: { branchId?: string | null } = {}) {
  const ctx = await getStaff();
  if (!ctx) throw new AuthzError("Staff sign-in required", "UNAUTHENTICATED");
  if (!ctx.permissions.has(perm)) throw new AuthzError(`Missing permission: ${perm}`);
  if (opts.branchId && !canAccessBranch(ctx, opts.branchId)) {
    throw new AuthzError("You do not have access to this branch");
  }
  return ctx;
}

/** For pages: redirects instead of throwing. */
export async function requireStaffPage(perm?: Permission): Promise<StaffContext> {
  const ctx = await getStaff();
  if (!ctx) redirect("/staff/login");
  if (perm && !ctx.permissions.has(perm)) redirect("/staff?denied=" + encodeURIComponent(perm));
  return ctx;
}

export async function requireCustomerPage(next = "/account") {
  const u = await getCurrentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

export function branchFilterFor(ctx: StaffContext, requested?: string | null): string[] | null {
  // Returns the set of branch ids this staff may query, narrowed by the requested filter.
  if (requested) {
    if (!canAccessBranch(ctx, requested)) return [];
    return [requested];
  }
  return ctx.branchIds; // null = all
}
