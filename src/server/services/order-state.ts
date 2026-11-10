import type { OrderStatus } from "@/server/db/schema/enums";
import type { Permission } from "@/server/auth/permissions";

/** Every legal status change. Anything not listed is refused. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  AWAITING_PAYMENT: ["PENDING_APPROVAL", "PAYMENT_FAILED", "EXPIRED"],
  PAYMENT_FAILED: ["PENDING_APPROVAL", "EXPIRED"], // customer may retry payment
  EXPIRED: ["PENDING_APPROVAL"], // a late but verified payment must still be honoured
  PENDING_APPROVAL: ["CONFIRMED", "REJECTED", "AWAITING_ADDITIONAL_PAYMENT"],
  AWAITING_ADDITIONAL_PAYMENT: ["PENDING_APPROVAL", "CONFIRMED", "PREPARING", "CANCELLED", "REJECTED"],
  CONFIRMED: ["PREPARING", "CANCELLED", "AWAITING_ADDITIONAL_PAYMENT"],
  PREPARING: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "CANCELLED", "AWAITING_ADDITIONAL_PAYMENT"],
  READY_FOR_PICKUP: ["COMPLETED"],
  OUT_FOR_DELIVERY: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus, type?: "PICKUP" | "DELIVERY"): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  if (to === "READY_FOR_PICKUP" && type === "DELIVERY") return false;
  if (to === "OUT_FOR_DELIVERY" && type === "PICKUP") return false;
  return true;
}

export type StaffAction = "approve" | "reject" | "start_preparing" | "mark_ready" | "out_for_delivery" | "complete" | "cancel";

export const STAFF_ACTIONS: Record<StaffAction, { from: OrderStatus[]; to: OrderStatus; perm: Permission; label: string }> = {
  approve: { from: ["PENDING_APPROVAL"], to: "CONFIRMED", perm: "orders.approve", label: "Approve" },
  reject: { from: ["PENDING_APPROVAL", "AWAITING_ADDITIONAL_PAYMENT"], to: "REJECTED", perm: "orders.reject", label: "Reject" },
  start_preparing: { from: ["CONFIRMED"], to: "PREPARING", perm: "orders.update_status", label: "Start preparing" },
  mark_ready: { from: ["PREPARING"], to: "READY_FOR_PICKUP", perm: "orders.update_status", label: "Ready for pickup" },
  out_for_delivery: { from: ["PREPARING"], to: "OUT_FOR_DELIVERY", perm: "orders.update_status", label: "Out for delivery" },
  complete: { from: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"], to: "COMPLETED", perm: "orders.update_status", label: "Complete" },
  cancel: {
    from: ["CONFIRMED", "PREPARING", "AWAITING_ADDITIONAL_PAYMENT"],
    to: "CANCELLED",
    perm: "orders.cancel",
    label: "Cancel order",
  },
};

/** Which staff actions are applicable to an order (before permission checks). */
export function availableActions(status: OrderStatus, type: "PICKUP" | "DELIVERY"): StaffAction[] {
  return (Object.keys(STAFF_ACTIONS) as StaffAction[]).filter((a) => {
    const def = STAFF_ACTIONS[a];
    if (!def.from.includes(status)) return false;
    if (a === "mark_ready" && type !== "PICKUP") return false;
    if (a === "out_for_delivery" && type !== "DELIVERY") return false;
    return true;
  });
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_FAILED: "Payment failed",
  EXPIRED: "Expired (unpaid)",
  PENDING_APPROVAL: "Pending approval",
  AWAITING_ADDITIONAL_PAYMENT: "Awaiting extra payment",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

/** Statuses that represent a paid order visible to staff. Unpaid / failed orders never appear in queues. */
export const STAFF_VISIBLE_STATUSES: OrderStatus[] = [
  "PENDING_APPROVAL",
  "AWAITING_ADDITIONAL_PAYMENT",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
];

export const ACTIVE_STATUSES: OrderStatus[] = [
  "PENDING_APPROVAL",
  "AWAITING_ADDITIONAL_PAYMENT",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
];
