import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import {
  branch,
  branchHours,
  deliveryInfo,
  order,
  orderItem,
  orderModification,
  orderStatusHistory,
  payment,
} from "@/server/db/schema";
import { newTrackingToken, orderReference, sha256 } from "@/lib/ids";
import { audit } from "./audit";
import { loadCatalogForBranch } from "./catalog";
import { orderingBlockReason } from "./branch-hours";
import { priceCart, PricingError } from "./pricing-core";
import { startPayment } from "./payments";
import { ACTIVE_STATUSES } from "./order-state";

const phoneRe = /^\+?[0-9][0-9\s-]{6,18}$/;

export const checkoutSchema = z
  .object({
    branchId: z.string().uuid(),
    type: z.enum(["PICKUP", "DELIVERY"]),
    customerName: z.string().trim().min(2, "Enter your name").max(80),
    customerPhone: z.string().trim().regex(phoneRe, "Enter a valid phone number"),
    customerEmail: z.string().trim().toLowerCase().email("Enter a valid email (Paystack sends your receipt here)").max(120),
    pickupTime: z
      .string()
      .trim()
      .regex(/^(ASAP|([01]\d|2[0-3]):[0-5]\d)$/)
      .optional()
      .nullable(),
    address: z.string().trim().max(300).optional().nullable(),
    landmark: z.string().trim().max(200).optional().nullable(),
    instructions: z.string().trim().max(500).optional().nullable(),
    saveAddress: z.boolean().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          optionIds: z.array(z.string().uuid()).max(10),
          quantity: z.number().int().min(1).max(50),
        }),
      )
      .min(1, "Your cart is empty")
      .max(40),
  })
  .superRefine((v, ctx) => {
    if (v.type === "DELIVERY" && (!v.address || v.address.length < 5)) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "Enter your delivery address" });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export class CheckoutError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

/**
 * Creates the order in AWAITING_PAYMENT using server-side prices only, then initializes payment.
 * Returns where to redirect the customer.
 */
export async function createOrderAndStartPayment(input: CheckoutInput, customerUserId: string | null) {
  const b = await db.query.branch.findFirst({ where: eq(branch.id, input.branchId) });
  if (!b) throw new CheckoutError("Please choose a branch.", "branchId");
  const hours = await db.select().from(branchHours).where(eq(branchHours.branchId, b.id));
  const blocked = orderingBlockReason(b, hours);
  if (blocked) throw new CheckoutError(blocked, "branchId");
  if (input.type === "PICKUP" && !b.pickupEnabled) throw new CheckoutError("Pickup is not available at this branch right now.", "type");
  if (input.type === "DELIVERY" && !b.deliveryEnabled) throw new CheckoutError("Delivery is not available at this branch right now.", "type");

  const token = newTrackingToken();
  const created = await db.transaction(async (tx) => {
    const catalog = await loadCatalogForBranch(tx, b.id, [...new Set(input.items.map((i) => i.productId))]);
    let priced;
    try {
      priced = priceCart(catalog, input.items, input.type === "DELIVERY" ? b.deliveryFeeKobo : 0);
    } catch (e) {
      if (e instanceof PricingError) throw new CheckoutError(e.message, "items");
      throw e;
    }
    // Reference collisions are astronomically unlikely, but retry defensively on the unique constraint.
    let ref = orderReference(b.code);
    for (let i = 0; i < 3; i++) {
      const clash = await tx.query.order.findFirst({ where: eq(order.reference, ref), columns: { id: true } });
      if (!clash) break;
      ref = orderReference(b.code);
    }
    const [o] = await tx
      .insert(order)
      .values({
        reference: ref,
        branchId: b.id,
        customerUserId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        type: input.type,
        pickupTime: input.type === "PICKUP" ? (input.pickupTime ?? "ASAP") : null,
        subtotalKobo: priced.subtotalKobo,
        deliveryFeeKobo: priced.deliveryFeeKobo,
        totalKobo: priced.totalKobo,
        status: "AWAITING_PAYMENT",
        paymentStatus: "UNPAID",
        trackingTokenHash: sha256(token),
      })
      .returning();
    await tx.insert(orderItem).values(
      priced.lines.map((l) => ({
        orderId: o.id,
        productId: l.productId,
        productName: l.productName,
        categoryName: l.categoryName,
        unitPriceKobo: l.unitPriceKobo,
        options: l.options,
        quantity: l.quantity,
        lineTotalKobo: l.lineTotalKobo,
      })),
    );
    if (input.type === "DELIVERY") {
      await tx.insert(deliveryInfo).values({
        orderId: o.id,
        address: input.address!,
        landmark: input.landmark || null,
        instructions: input.instructions || null,
      });
    }
    await tx.insert(orderStatusHistory).values({ orderId: o.id, fromStatus: null, toStatus: "AWAITING_PAYMENT", note: "Order placed" });
    await audit(tx, { actorUserId: customerUserId, actorLabel: customerUserId ? undefined : "guest", action: "order.created", entity: "order", entityId: o.id, branchId: b.id, data: { totalKobo: o.totalKobo } });
    return o;
  });

  const pay = await startPayment({ orderId: created.id, purpose: "ORDER", amountKobo: created.totalKobo });
  return { orderId: created.id, reference: created.reference, token, authorizationUrl: pay.authorizationUrl };
}

/** Retry payment for an order that has not been paid yet. */
export async function retryOrderPayment(orderId: string) {
  const o = await db.query.order.findFirst({ where: eq(order.id, orderId) });
  if (!o) throw new CheckoutError("Order not found");
  if (!["AWAITING_PAYMENT", "PAYMENT_FAILED"].includes(o.status)) throw new CheckoutError("This order can no longer be paid.");
  return startPayment({ orderId: o.id, purpose: "ORDER", amountKobo: o.totalKobo });
}

// ---------------- Queries ----------------

export async function getOrderDetail(orderId: string) {
  const o = await db.query.order.findFirst({ where: eq(order.id, orderId) });
  if (!o) return null;
  const [items, delivery, history, payments, mods, br] = await Promise.all([
    db.select().from(orderItem).where(eq(orderItem.orderId, o.id)),
    db.query.deliveryInfo.findFirst({ where: eq(deliveryInfo.orderId, o.id) }),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, o.id)).orderBy(asc(orderStatusHistory.createdAt)),
    db.select().from(payment).where(eq(payment.orderId, o.id)).orderBy(asc(payment.createdAt)),
    db.select().from(orderModification).where(eq(orderModification.orderId, o.id)).orderBy(asc(orderModification.createdAt)),
    db.query.branch.findFirst({ where: eq(branch.id, o.branchId) }),
  ]);
  return { order: o, items, delivery: delivery ?? null, history, payments, modifications: mods, branch: br! };
}
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

/** Guest tracking: token link. */
export async function findOrderByToken(reference: string, token: string) {
  const o = await db.query.order.findFirst({ where: eq(order.reference, reference.toUpperCase()) });
  if (!o || o.trackingTokenHash !== sha256(token)) return null;
  return o;
}

/** Guest tracking: reference + phone (digits compared, last 10). */
export async function findOrderByPhone(reference: string, phone: string) {
  const o = await db.query.order.findFirst({ where: eq(order.reference, reference.trim().toUpperCase()) });
  if (!o) return null;
  const norm = (s: string) => s.replace(/\D/g, "").slice(-10);
  if (norm(o.customerPhone) !== norm(phone) || norm(phone).length < 7) return null;
  return o;
}

export async function listCustomerOrders(userId: string) {
  return db.select().from(order).where(eq(order.customerUserId, userId)).orderBy(desc(order.createdAt)).limit(100);
}

export async function listActiveCustomerOrders(userId: string) {
  return db
    .select()
    .from(order)
    .where(and(eq(order.customerUserId, userId), inArray(order.status, ACTIVE_STATUSES)))
    .orderBy(desc(order.createdAt));
}
