import type { OrderStatus } from "@/server/db/schema/enums";
import { STATUS_LABELS } from "@/server/services/order-state";
import { Badge } from "./card";

const tone: Record<OrderStatus, "neutral" | "orange" | "red" | "green" | "dark" | "blue"> = {
  AWAITING_PAYMENT: "neutral",
  PAYMENT_FAILED: "red",
  EXPIRED: "neutral",
  PENDING_APPROVAL: "orange",
  AWAITING_ADDITIONAL_PAYMENT: "orange",
  CONFIRMED: "blue",
  PREPARING: "blue",
  READY_FOR_PICKUP: "green",
  OUT_FOR_DELIVERY: "green",
  COMPLETED: "dark",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={tone[status]}>{STATUS_LABELS[status]}</Badge>;
}
