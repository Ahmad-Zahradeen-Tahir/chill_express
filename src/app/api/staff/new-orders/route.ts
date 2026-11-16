import { NextResponse } from "next/server";
import { AuthzError, requirePermission } from "@/server/auth/guard";
import { listItemsForOrders, listStaffOrders } from "@/server/services/staff-orders";
import { describeOptions } from "@/server/services/pricing-core";
import { formatNaira } from "@/lib/money";

export type NewOrderPopup = {
  id: string;
  reference: string;
  createdAt: string;
  branchName: string;
  type: "PICKUP" | "DELIVERY";
  customerName: string;
  total: string;
  items: string[];
};

/** Paid orders waiting for approval in the caller's branches, oldest first. Polled by the cashier's new-order popups. */
export async function GET() {
  try {
    const ctx = await requirePermission("orders.view");
    const orders = (await listStaffOrders(ctx, { status: "PENDING_APPROVAL" }, 50)).sort((a, b) => +a.createdAt - +b.createdAt);
    const items = await listItemsForOrders(orders.map((o) => o.id));
    const body: NewOrderPopup[] = orders.map((o) => ({
      id: o.id,
      reference: o.reference,
      createdAt: o.createdAt.toISOString(),
      branchName: o.branchName,
      type: o.type,
      customerName: o.customerName,
      total: formatNaira(o.totalKobo),
      items: items
        .filter((i) => i.orderId === o.id)
        .map((i) => `${i.quantity}× ${i.productName}${i.options.length ? ` · ${describeOptions(i.options)}` : ""}`),
    }));
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof AuthzError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
