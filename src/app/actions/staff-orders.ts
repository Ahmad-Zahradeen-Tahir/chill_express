"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { order } from "@/server/db/schema";
import { AuthzError, requirePermission, getStaff } from "@/server/auth/guard";
import { modifyOrder, modifySchema, OrderActionError, performStaffAction, withdrawModification } from "@/server/services/staff-orders";
import type { StaffAction } from "@/server/services/order-state";
import { reconcilePayments, confirmPayment } from "@/server/services/payments";
import { markAllRead, markRead, unreadCount } from "@/server/services/notifications";
import { z } from "zod";
import { PaymentProviderError } from "@/server/paystack/provider";

type R = { ok: true; message?: string; paymentUrl?: string } | { ok: false; error: string };

function fail(e: unknown): R {
  if (e instanceof OrderActionError || e instanceof AuthzError || e instanceof PaymentProviderError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function staffOrderAction(orderId: string, action: StaffAction): Promise<R> {
  try {
    await performStaffAction(orderId, action);
    revalidatePath("/staff", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function staffModifyOrder(raw: unknown): Promise<R> {
  const p = modifySchema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  try {
    const r = await modifyOrder(p.data);
    revalidatePath("/staff", "layout");
    const msg =
      r.outcome === "applied" ? "Changes saved." : `Order held until the customer pays the extra ₦${(r.deltaKobo / 100).toLocaleString()}.`;
    return { ok: true, message: msg, paymentUrl: r.paymentUrl };
  } catch (e) {
    return fail(e);
  }
}

export async function staffWithdrawModification(orderId: string): Promise<R> {
  try {
    await withdrawModification(orderId);
    revalidatePath("/staff", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Re-check payment state with the provider for one order. */
export async function staffRecheckOrder(orderId: string): Promise<R> {
  try {
    const o = await db.query.order.findFirst({ where: eq(order.id, orderId), with: undefined });
    if (!o) return { ok: false, error: "Order not found" };
    await requirePermission("orders.view", { branchId: o.branchId });
    const pays = await db.query.payment.findMany({ where: (p, { eq: e }) => e(p.orderId, o.id) });
    for (const p of pays) if (p.status === "INITIALIZED" && p.provider !== "DEMO_SEED") await confirmPayment(p.reference, "staff-recheck").catch(() => null);
    revalidatePath("/staff", "layout");
    return { ok: true, message: "Re-checked with the payment provider." };
  } catch (e) {
    return fail(e);
  }
}

export async function staffReconcileAll(): Promise<R> {
  try {
    await requirePermission("orders.modify");
    const p = await reconcilePayments();
    revalidatePath("/staff", "layout");
    return { ok: true, message: `Payments checked: ${p.checked} (confirmed ${p.confirmed}, expired ${p.expired}).` };
  } catch (e) {
    return fail(e);
  }
}

export async function markNotificationsRead() {
  const ctx = await getStaff();
  if (!ctx) return;
  await markAllRead(ctx);
  revalidatePath("/staff", "layout");
}

/** Called when a user clicks a notification: marks it read, which removes it from their inbox. */
export async function openNotification(id: string): Promise<number> {
  const ctx = await getStaff();
  if (!ctx) return 0;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return 0;
  const n = await markRead(ctx, [parsed.data]);
  if (n) revalidatePath("/staff", "layout");
  return n;
}

export async function pollUnread(): Promise<number> {
  const ctx = await getStaff();
  return ctx ? unreadCount(ctx) : 0;
}
