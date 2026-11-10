"use server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { APIError } from "better-auth/api";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import { account, session, staffBranch, user, userPermissionOverride } from "@/server/db/schema";
import { AuthzError, getStaff, requirePermission } from "@/server/auth/guard";
import { ALL_PERMISSIONS, isStaffRole, ROLE_DEFAULT_PERMISSIONS, type Permission } from "@/server/auth/permissions";
import { audit } from "@/server/services/audit";
import { randomCode } from "@/lib/ids";

type R = { ok?: boolean; error?: string; tempPassword?: string };

function tempPassword() {
  return `Chill-${randomCode(4)}-${randomCode(4)}`;
}

export async function changeOwnPassword(_: R, form: FormData): Promise<R> {
  const ctx = await getStaff();
  if (!ctx) return { error: "Sign in required" };
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 10) return { error: "New password must be at least 10 characters." };
  try {
    await auth.api.changePassword({ body: { currentPassword: current, newPassword: next, revokeOtherSessions: true }, headers: await headers() });
  } catch (e) {
    return { error: e instanceof APIError ? (e.body?.message ?? "Could not change password") : "Could not change password" };
  }
  await db.update(user).set({ mustChangePassword: false, updatedAt: new Date() }).where(eq(user.id, ctx.userId));
  await audit(db, { actorUserId: ctx.userId, action: "staff.password_changed", entity: "user", entityId: ctx.userId });
  revalidatePath("/staff", "layout");
  return { ok: true };
}

const staffSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  role: z.enum(["CASHIER", "BRANCH_MANAGER", "CENTRAL_MANAGER", "CEO"]),
  branchIds: z.array(z.string().uuid()),
});

function parseStaffForm(form: FormData) {
  return staffSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone") ?? "",
    role: form.get("role"),
    branchIds: form.getAll("branchIds").map(String),
  });
}

async function guardRoleAssignment(role: string) {
  const ctx = await requirePermission("staff.manage");
  // Only the CEO can create or promote another CEO.
  if (role === "CEO" && ctx.role !== "CEO") throw new AuthzError("Only the CEO can assign the CEO role");
  return ctx;
}

export async function createStaff(_: R, form: FormData): Promise<R> {
  const p = parseStaffForm(form);
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    const ctx = await guardRoleAssignment(p.data.role);
    if (["CASHIER", "BRANCH_MANAGER"].includes(p.data.role) && !p.data.branchIds.length) return { error: "Assign at least one branch for this role." };
    const exists = await db.query.user.findFirst({ where: eq(user.email, p.data.email) });
    if (exists) return { error: "An account with this email already exists." };
    const pw = tempPassword();
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(user).values({ id, name: p.data.name, email: p.data.email, phone: p.data.phone || null, role: p.data.role, emailVerified: true, mustChangePassword: true });
      await tx.insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword(pw) });
      if (p.data.branchIds.length && !["CENTRAL_MANAGER", "CEO"].includes(p.data.role)) {
        await tx.insert(staffBranch).values(p.data.branchIds.map((b) => ({ userId: id, branchId: b })));
      }
      await audit(tx, { actorUserId: ctx.userId, action: "staff.created", entity: "user", entityId: id, data: { role: p.data.role, branchIds: p.data.branchIds } });
    });
    revalidatePath("/admin/staff");
    return { ok: true, tempPassword: pw };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateStaff(userId: string, _: R, form: FormData): Promise<R> {
  const p = parseStaffForm(form);
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    const ctx = await guardRoleAssignment(p.data.role);
    const target = await db.query.user.findFirst({ where: eq(user.id, userId) });
    if (!target || !isStaffRole(target.role)) return { error: "Staff member not found" };
    if (target.role === "CEO" && ctx.role !== "CEO") return { error: "Only the CEO can edit the CEO account" };
    if (target.id === ctx.userId && p.data.role !== target.role) return { error: "You can't change your own role." };
    await db.transaction(async (tx) => {
      await tx.update(user).set({ name: p.data.name, email: p.data.email, phone: p.data.phone || null, role: p.data.role, updatedAt: new Date() }).where(eq(user.id, userId));
      await tx.delete(staffBranch).where(eq(staffBranch.userId, userId));
      if (p.data.branchIds.length && !["CENTRAL_MANAGER", "CEO"].includes(p.data.role)) {
        await tx.insert(staffBranch).values(p.data.branchIds.map((b) => ({ userId, branchId: b })));
      }
      await audit(tx, { actorUserId: ctx.userId, action: "staff.updated", entity: "user", entityId: userId, data: { before: { role: target.role }, after: { role: p.data.role, branchIds: p.data.branchIds } } });
    });
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function setStaffStatus(userId: string, status: "ACTIVE" | "SUSPENDED"): Promise<R> {
  try {
    const ctx = await requirePermission("staff.manage");
    if (userId === ctx.userId) return { error: "You can't suspend yourself." };
    const target = await db.query.user.findFirst({ where: eq(user.id, userId) });
    if (!target || !isStaffRole(target.role)) return { error: "Not found" };
    if (target.role === "CEO" && ctx.role !== "CEO") return { error: "Not allowed" };
    await db.transaction(async (tx) => {
      await tx.update(user).set({ status, updatedAt: new Date() }).where(eq(user.id, userId));
      if (status === "SUSPENDED") await tx.delete(session).where(eq(session.userId, userId)); // immediate sign-out
      await audit(tx, { actorUserId: ctx.userId, action: status === "SUSPENDED" ? "staff.suspended" : "staff.reactivated", entity: "user", entityId: userId });
    });
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Issues a one-time temporary password (shown once to the admin), forces change at next sign-in, revokes sessions. */
export async function resetStaffPassword(userId: string): Promise<R> {
  try {
    const ctx = await requirePermission("staff.manage");
    const target = await db.query.user.findFirst({ where: eq(user.id, userId) });
    if (!target || !isStaffRole(target.role)) return { error: "Not found" };
    if (target.role === "CEO" && ctx.role !== "CEO") return { error: "Not allowed" };
    const pw = tempPassword();
    const hash = await hashPassword(pw);
    await db.transaction(async (tx) => {
      const upd = await tx.update(account).set({ password: hash, updatedAt: new Date() }).where(and(eq(account.userId, userId), eq(account.providerId, "credential"))).returning({ id: account.id });
      if (!upd.length) await tx.insert(account).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: hash });
      await tx.update(user).set({ mustChangePassword: true, updatedAt: new Date() }).where(eq(user.id, userId));
      await tx.delete(session).where(eq(session.userId, userId));
      await audit(tx, { actorUserId: ctx.userId, action: "staff.password_reset", entity: "user", entityId: userId });
    });
    return { ok: true, tempPassword: pw };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function setPermissionOverrides(userId: string, granted: string[]): Promise<R> {
  try {
    const ctx = await requirePermission("staff.manage");
    const target = await db.query.user.findFirst({ where: eq(user.id, userId) });
    if (!target || !isStaffRole(target.role) || target.role === "CEO") return { error: "Permissions can't be customised for this account" };
    const defaults = new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[target.role]);
    const want = new Set(granted.filter((g): g is Permission => (ALL_PERMISSIONS as string[]).includes(g)));
    const rows = ALL_PERMISSIONS.filter((p) => defaults.has(p) !== want.has(p)).map((p) => ({ userId, permissionKey: p, granted: want.has(p) }));
    await db.transaction(async (tx) => {
      await tx.delete(userPermissionOverride).where(eq(userPermissionOverride.userId, userId));
      if (rows.length) await tx.insert(userPermissionOverride).values(rows);
      await audit(tx, { actorUserId: ctx.userId, action: "staff.permissions_updated", entity: "user", entityId: userId, data: { overrides: rows } });
    });
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}
