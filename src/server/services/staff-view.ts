import "server-only";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { branch } from "@/server/db/schema";
import { hasPermission, type StaffContext } from "@/server/auth/permissions";
import type { OrderStatus } from "@/server/db/schema/enums";
import { availableActions, STAFF_ACTIONS, type StaffAction } from "./order-state";

export async function branchesFor(ctx: StaffContext) {
  if (ctx.branchIds === null) return db.select({ id: branch.id, name: branch.name }).from(branch).orderBy(asc(branch.name));
  if (!ctx.branchIds.length) return [];
  return db.select({ id: branch.id, name: branch.name }).from(branch).where(inArray(branch.id, ctx.branchIds)).orderBy(asc(branch.name));
}

export function allowedActions(ctx: StaffContext, o: { status: OrderStatus; type: "PICKUP" | "DELIVERY"; branchId: string }): StaffAction[] {
  return availableActions(o.status, o.type).filter((a) => hasPermission(ctx, STAFF_ACTIONS[a].perm, o.branchId));
}

export function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

export function lagosDayStart(offsetDays = 0) {
  // Midnight Africa/Lagos (UTC+1) as a UTC Date.
  const now = new Date(Date.now() + 3600_000);
  const d = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offsetDays) - 3600_000;
  return new Date(d);
}
