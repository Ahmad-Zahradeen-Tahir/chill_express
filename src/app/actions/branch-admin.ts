"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { branch, branchHours, siteSetting } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/guard";
import { audit } from "@/server/services/audit";
import { notifyStaff } from "@/server/services/notifications";

type R = { ok?: boolean; error?: string };
const bool = (v: FormDataEntryValue | null) => v === "on";
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveBranch(branchId: string, _: R, form: FormData): Promise<R> {
  const ctx = await requirePermission("branches.manage", { branchId });
  const p = z
    .object({
      name: z.string().trim().min(2).max(60),
      address: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(30).optional(),
      deliveryFee: z.coerce.number().min(0).max(100000),
      prepTimeMins: z.coerce.number().int().min(1).max(240),
      closedMessage: z.string().trim().max(200).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const before = await db.query.branch.findFirst({ where: eq(branch.id, branchId) });
  if (!before) return { error: "Branch not found" };
  const values = {
    name: p.data.name,
    address: p.data.address || null,
    phone: p.data.phone || null,
    deliveryFeeKobo: Math.round(p.data.deliveryFee * 100),
    prepTimeMins: p.data.prepTimeMins,
    closedMessage: p.data.closedMessage || null,
    isOpen: bool(form.get("isOpen")),
    acceptingOrders: bool(form.get("acceptingOrders")),
    pickupEnabled: bool(form.get("pickupEnabled")),
    deliveryEnabled: bool(form.get("deliveryEnabled")),
    enforceHours: bool(form.get("enforceHours")),
    updatedAt: new Date(),
  };
  await db.transaction(async (tx) => {
    await tx.update(branch).set(values).where(eq(branch.id, branchId));
    await audit(tx, { actorUserId: ctx.userId, action: "branch.updated", entity: "branch", entityId: branchId, branchId, data: { before, after: values } });
    if (before.isOpen && !values.isOpen) {
      await notifyStaff(tx, { type: "branch.closed", title: `${values.name} temporarily closed`, body: values.closedMessage ?? undefined, branchId, permissionKey: "orders.view" });
    }
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveHours(branchId: string, _: R, form: FormData): Promise<R> {
  const ctx = await requirePermission("branches.manage", { branchId });
  const rows: (typeof branchHours.$inferInsert)[] = [];
  for (let d = 0; d < 7; d++) {
    const closed = bool(form.get(`closed_${d}`));
    const opens = String(form.get(`opens_${d}`) ?? "");
    const closes = String(form.get(`closes_${d}`) ?? "");
    if (!closed && (opens || closes) && (!hhmm.test(opens) || !hhmm.test(closes))) return { error: "Use 24-hour times like 10:00 and 22:00" };
    rows.push({ branchId, dayOfWeek: d, opens: opens || null, closes: closes || null, closed });
  }
  await db.transaction(async (tx) => {
    await tx.delete(branchHours).where(eq(branchHours.branchId, branchId));
    await tx.insert(branchHours).values(rows);
    await audit(tx, { actorUserId: ctx.userId, action: "branch.hours_updated", entity: "branch", entityId: branchId, branchId, data: rows });
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveBusinessSettings(_: R, form: FormData): Promise<R> {
  const ctx = await requirePermission("branches.manage");
  if (ctx.branchIds !== null) return { error: "Only company-wide administrators can edit business contact details" };
  const p = z
    .object({ phone: z.string().trim().min(7).max(30), instagram: z.string().trim().min(2).max(60), email: z.union([z.literal(""), z.string().trim().email()]) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const ig = p.data.instagram.startsWith("@") ? p.data.instagram : `@${p.data.instagram}`;
  await db.transaction(async (tx) => {
    for (const [key, value] of [["business.phone", p.data.phone], ["business.instagram", ig], ["business.email", p.data.email || null]] as const) {
      await tx.insert(siteSetting).values({ key, value }).onConflictDoUpdate({ target: siteSetting.key, set: { value, updatedAt: new Date() } });
    }
    await audit(tx, { actorUserId: ctx.userId, action: "settings.updated", entity: "settings", data: p.data });
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
