import "server-only";
import { eq } from "drizzle-orm";
import type { Tx } from "@/server/db";
import { deliveryInfo, order, orderItem } from "@/server/db/schema";
import type { PricedLine } from "./pricing-core";

/** Snapshot of the full post-modification order state. Applied atomically. */
export type ModificationAfter = {
  items: PricedLine[];
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  delivery: { address: string; landmark: string | null; instructions: string | null } | null;
};

export async function applyModificationAfter(tx: Tx, orderId: string, after: ModificationAfter) {
  await tx.delete(orderItem).where(eq(orderItem.orderId, orderId));
  if (after.items.length) {
    await tx.insert(orderItem).values(
      after.items.map((l) => ({
        orderId,
        productId: l.productId,
        productName: l.productName,
        categoryName: l.categoryName,
        unitPriceKobo: l.unitPriceKobo,
        options: l.options,
        quantity: l.quantity,
        lineTotalKobo: l.lineTotalKobo,
      })),
    );
  }
  await tx
    .update(order)
    .set({
      subtotalKobo: after.subtotalKobo,
      deliveryFeeKobo: after.deliveryFeeKobo,
      totalKobo: after.totalKobo,
      customerName: after.customerName,
      customerPhone: after.customerPhone,
      customerEmail: after.customerEmail,
      updatedAt: new Date(),
    })
    .where(eq(order.id, orderId));
  if (after.delivery) {
    await tx
      .insert(deliveryInfo)
      .values({ orderId, ...after.delivery })
      .onConflictDoUpdate({ target: deliveryInfo.orderId, set: after.delivery });
  }
}
