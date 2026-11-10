import "server-only";
import { and, desc, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { branch, deliveryInfo, order, orderItem, orderModification, orderStatusHistory, payment } from "@/server/db/schema";
import type { OrderStatus } from "@/server/db/schema/enums";
import { formatNaira } from "@/lib/money";
import { AuthzError, requirePermission } from "@/server/auth/guard";
import { canAccessBranch, type StaffContext } from "@/server/auth/permissions";
import { audit } from "./audit";
import { loadCatalogForBranch } from "./catalog";
import { applyModificationAfter, type ModificationAfter } from "./modification-apply";
import { messageCustomer, notifyStaff } from "./notifications";
import { canTransition, STAFF_ACTIONS, STAFF_VISIBLE_STATUSES, STATUS_LABELS, type StaffAction } from "./order-state";
import { priceLine, PricingError, type PricedLine } from "./pricing-core";
import { startPayment } from "./payments";

export class OrderActionError extends Error {}

async function loadOrderForStaff(orderId: string) {
  const o = await db.query.order.findFirst({ where: eq(order.id, orderId) });
  if (!o) throw new OrderActionError("Order not found");
  return o;
}

/** Approve / kitchen workflow. Permission + branch enforced here. */
export async function performStaffAction(orderId: string, action: StaffAction, note?: string | null) {
  const def = STAFF_ACTIONS[action];
  if (!def) throw new OrderActionError("Unknown action");
  const o = await loadOrderForStaff(orderId);
  const ctx = await requirePermission(def.perm, { branchId: o.branchId });
  if (!def.from.includes(o.status) || !canTransition(o.status, def.to, o.type)) {
    throw new OrderActionError(`Cannot ${def.label.toLowerCase()} an order that is ${STATUS_LABELS[o.status].toLowerCase()}.`);
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    const extra: Partial<typeof order.$inferInsert> = {};
    if (action === "approve") extra.approvedAt = now;
    if (action === "complete") extra.completedAt = now;
    // Optimistic concurrency: only succeeds if nobody changed the status meanwhile.
    const upd = await tx
      .update(order)
      .set({ ...extra, status: def.to, statusBeforeHold: null, updatedAt: now })
      .where(and(eq(order.id, o.id), eq(order.status, o.status)))
      .returning({ id: order.id });
    if (!upd.length) throw new OrderActionError("This order was just updated by someone else. Refresh and try again.");
    await tx.insert(orderStatusHistory).values({ orderId: o.id, fromStatus: o.status, toStatus: def.to, actorUserId: ctx.userId, note: note?.trim() || null });
    await audit(tx, { actorUserId: ctx.userId, action: `order.${action}`, entity: "order", entityId: o.id, branchId: o.branchId, data: { from: o.status, to: def.to, note } });

    if (action === "approve") {
      await notifyStaff(tx, {
        type: "order.approved",
        title: `Order approved · ${o.reference}`,
        body: `Approved by ${ctx.name}`,
        orderId: o.id,
        branchId: o.branchId,
        link: `/staff/orders/${o.id}`,
        permissionKey: "analytics.view",
      });
    }
    await messageCustomer(tx, o, `status_${def.to.toLowerCase()}`, { reference: o.reference, status: def.to });
  });
}

// ---------------- Modifications ----------------

export const modifySchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(3, "Give a reason for the change").max(300),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().min(7).max(20),
  customerEmail: z.string().trim().toLowerCase().email().max(120).nullable(),
  delivery: z
    .object({
      address: z.string().trim().min(5).max(300),
      landmark: z.string().trim().max(200).nullable(),
      instructions: z.string().trim().max(500).nullable(),
    })
    .nullable(),
  items: z
    .array(
      z.object({
        existingItemId: z.string().uuid().nullable(),
        productId: z.string().uuid(),
        optionIds: z.array(z.string().uuid()).max(10),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .min(1, "An order needs at least one item")
    .max(40),
});
export type ModifyInput = z.infer<typeof modifySchema>;

const MODIFIABLE: OrderStatus[] = ["PENDING_APPROVAL", "CONFIRMED", "PREPARING"];

export async function modifyOrder(input: ModifyInput): Promise<{ outcome: "applied" | "awaiting_payment"; deltaKobo: number; paymentUrl?: string }> {
  const o = await loadOrderForStaff(input.orderId);
  const ctx = await requirePermission("orders.modify", { branchId: o.branchId });
  if (!MODIFIABLE.includes(o.status)) throw new OrderActionError(`Orders that are ${STATUS_LABELS[o.status].toLowerCase()} cannot be modified.`);
  if ((o.type === "DELIVERY") !== !!input.delivery) throw new OrderActionError("Delivery details do not match the order type.");

  const existingItems = await db.select().from(orderItem).where(eq(orderItem.orderId, o.id));
  const delivery = await db.query.deliveryInfo.findFirst({ where: eq(deliveryInfo.orderId, o.id) });

  // Price new lines from the live catalog; keep the original snapshot price for untouched existing lines.
  const catalog = await loadCatalogForBranch(db, o.branchId, [...new Set(input.items.map((i) => i.productId))]);
  const lines: PricedLine[] = [];
  for (const l of input.items) {
    const ex = l.existingItemId ? existingItems.find((e) => e.id === l.existingItemId) : null;
    if (ex) {
      if (ex.productId !== l.productId) throw new OrderActionError("Item mismatch. Refresh and try again.");
      lines.push({
        productId: ex.productId!,
        productName: ex.productName,
        categoryName: ex.categoryName,
        unitPriceKobo: ex.unitPriceKobo,
        quantity: l.quantity,
        lineTotalKobo: ex.unitPriceKobo * l.quantity,
        options: ex.options,
      });
    } else {
      try {
        lines.push(priceLine(catalog.get(l.productId), { productId: l.productId, optionIds: l.optionIds, quantity: l.quantity }));
      } catch (e) {
        if (e instanceof PricingError) throw new OrderActionError(e.message);
        throw e;
      }
    }
  }
  const subtotal = lines.reduce((s, l) => s + l.lineTotalKobo, 0);
  const after: ModificationAfter = {
    items: lines,
    subtotalKobo: subtotal,
    deliveryFeeKobo: o.deliveryFeeKobo,
    totalKobo: subtotal + o.deliveryFeeKobo,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    delivery: input.delivery,
  };
  const before = {
    items: existingItems,
    subtotalKobo: o.subtotalKobo,
    deliveryFeeKobo: o.deliveryFeeKobo,
    totalKobo: o.totalKobo,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    delivery: delivery ?? null,
  };
  const delta = after.totalKobo - o.totalKobo;

  if (delta > 0 && !(input.customerEmail ?? o.customerEmail)) {
    throw new OrderActionError("A customer email is required to collect the extra payment through Paystack.");
  }

  let modId = "";
  await db.transaction(async (tx) => {
    const pendingMod = await tx.query.orderModification.findFirst({
      where: and(eq(orderModification.orderId, o.id), eq(orderModification.status, "AWAITING_PAYMENT")),
    });
    if (pendingMod) throw new OrderActionError("This order already has a modification awaiting payment.");
    const lock = await tx
      .update(order)
      .set({ updatedAt: new Date() })
      .where(and(eq(order.id, o.id), eq(order.status, o.status)))
      .returning({ id: order.id });
    if (!lock.length) throw new OrderActionError("This order was just updated by someone else. Refresh and try again.");

    const status = delta > 0 ? "AWAITING_PAYMENT" : "APPLIED";
    const [mod] = await tx
      .insert(orderModification)
      .values({ orderId: o.id, actorUserId: ctx.userId, reason: input.reason, before, after, deltaKobo: delta, status, resolvedAt: delta > 0 ? null : new Date() })
      .returning({ id: orderModification.id });
    modId = mod.id;

    if (delta > 0) {
      // Hold the order until the extra amount is paid and verified. The paid total is NOT changed yet.
      await tx
        .update(order)
        .set({ status: "AWAITING_ADDITIONAL_PAYMENT", statusBeforeHold: o.status, updatedAt: new Date() })
        .where(eq(order.id, o.id));
      await tx.insert(orderStatusHistory).values({
        orderId: o.id,
        fromStatus: o.status,
        toStatus: "AWAITING_ADDITIONAL_PAYMENT",
        actorUserId: ctx.userId,
        note: `Modification needs extra ${formatNaira(delta)}: ${input.reason}`,
      });
    } else {
      // Same or lower total: applied straight away. No money is returned through the platform.
      await applyModificationAfter(tx, o.id, after);
    }
    await audit(tx, { actorUserId: ctx.userId, action: "order.modified", entity: "order", entityId: o.id, branchId: o.branchId, data: { deltaKobo: delta, reason: input.reason, modificationId: mod.id } });
    await messageCustomer(tx, o, "order_modified", { reference: o.reference, deltaKobo: delta });
  });

  if (delta > 0) {
    const pay = await startPayment({ orderId: o.id, purpose: "ADDITIONAL", amountKobo: delta, modificationId: modId });
    return { outcome: "awaiting_payment", deltaKobo: delta, paymentUrl: pay.authorizationUrl };
  }
  return { outcome: "applied", deltaKobo: delta };
}

/** Withdraw a modification that is waiting for extra payment; the order returns to its previous status unchanged. */
export async function withdrawModification(orderId: string) {
  const o = await loadOrderForStaff(orderId);
  const ctx = await requirePermission("orders.modify", { branchId: o.branchId });
  if (o.status !== "AWAITING_ADDITIONAL_PAYMENT") throw new OrderActionError("No modification is awaiting payment.");
  await db.transaction(async (tx) => {
    await tx
      .update(orderModification)
      .set({ status: "CANCELLED", resolvedAt: new Date() })
      .where(and(eq(orderModification.orderId, o.id), eq(orderModification.status, "AWAITING_PAYMENT")));
    const restore = o.statusBeforeHold ?? "PENDING_APPROVAL";
    const upd = await tx
      .update(order)
      .set({ status: restore, statusBeforeHold: null, updatedAt: new Date() })
      .where(and(eq(order.id, o.id), eq(order.status, "AWAITING_ADDITIONAL_PAYMENT")))
      .returning({ id: order.id });
    if (!upd.length) throw new OrderActionError("Order changed. Refresh and try again.");
    await tx.insert(orderStatusHistory).values({ orderId: o.id, fromStatus: o.status, toStatus: restore, actorUserId: ctx.userId, note: "Modification withdrawn" });
    // Abandon any unpaid additional payment links.
    await tx
      .update(payment)
      .set({ status: "ABANDONED", updatedAt: new Date() })
      .where(and(eq(payment.orderId, o.id), eq(payment.purpose, "ADDITIONAL"), eq(payment.status, "INITIALIZED")));
    await audit(tx, { actorUserId: ctx.userId, action: "order.modification_withdrawn", entity: "order", entityId: o.id, branchId: o.branchId });
  });
}

// ---------------- Queries ----------------

export type OrderFilters = {
  branchId?: string | null;
  status?: OrderStatus | "ACTIVE" | null;
  type?: "PICKUP" | "DELIVERY" | null;
  from?: Date | null;
  to?: Date | null;
  q?: string | null;
};

export function staffOrderWhere(ctx: StaffContext, f: OrderFilters): SQL | undefined {
  const conds: SQL[] = [inArray(order.status, STAFF_VISIBLE_STATUSES)];
  if (f.branchId) {
    if (!canAccessBranch(ctx, f.branchId)) throw new AuthzError("You do not have access to this branch");
    conds.push(eq(order.branchId, f.branchId));
  } else if (ctx.branchIds !== null) {
    conds.push(ctx.branchIds.length ? inArray(order.branchId, ctx.branchIds) : sql`false`);
  }
  if (f.status === "ACTIVE") conds.push(inArray(order.status, ["PENDING_APPROVAL", "AWAITING_ADDITIONAL_PAYMENT", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"]));
  else if (f.status) conds.push(eq(order.status, f.status));
  if (f.type) conds.push(eq(order.type, f.type));
  if (f.from) conds.push(gte(order.createdAt, f.from));
  if (f.to) conds.push(lt(order.createdAt, f.to));
  if (f.q) conds.push(sql`(${order.reference} ILIKE ${"%" + f.q + "%"} OR ${order.customerName} ILIKE ${"%" + f.q + "%"} OR ${order.customerPhone} ILIKE ${"%" + f.q + "%"})`);
  return and(...conds);
}

export async function listStaffOrders(ctx: StaffContext, f: OrderFilters, limit = 200) {
  const rows = await db
    .select({
      o: order,
      branchName: branch.name,
      itemCount: sql<number>`(select coalesce(sum(quantity),0)::int from order_item where order_item.order_id = ${order.id})`,
    })
    .from(order)
    .innerJoin(branch, eq(branch.id, order.branchId))
    .where(staffOrderWhere(ctx, f))
    .orderBy(desc(order.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.o, branchName: r.branchName, itemCount: r.itemCount }));
}
export type StaffOrderRow = Awaited<ReturnType<typeof listStaffOrders>>[number];

export async function listItemsForOrders(orderIds: string[]) {
  if (!orderIds.length) return [];
  return db.select().from(orderItem).where(inArray(orderItem.orderId, orderIds));
}
