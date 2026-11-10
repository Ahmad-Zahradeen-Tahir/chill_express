import { pgEnum } from "drizzle-orm/pg-core";

export const ROLES = ["CUSTOMER", "CASHIER", "BRANCH_MANAGER", "CENTRAL_MANAGER", "CEO"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES = ["CASHIER", "BRANCH_MANAGER", "CENTRAL_MANAGER", "CEO"] as const satisfies readonly Role[];

export const ORDER_STATUSES = [
  "AWAITING_PAYMENT",
  "PAYMENT_FAILED",
  "EXPIRED",
  "PENDING_APPROVAL",
  "AWAITING_ADDITIONAL_PAYMENT",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["UNPAID", "PAID"] as const;
export type OrderPaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);
export const orderPaymentStatusEnum = pgEnum("order_payment_status", PAYMENT_STATUSES);
export const orderTypeEnum = pgEnum("order_type", ["PICKUP", "DELIVERY"]);
export const paymentPurposeEnum = pgEnum("payment_purpose", ["ORDER", "ADDITIONAL"]);
export const paymentTxnStatusEnum = pgEnum("payment_txn_status", ["INITIALIZED", "SUCCESS", "FAILED", "ABANDONED"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["PAYSTACK", "DEV_SIM", "DEMO_SEED"]);
export const modificationStatusEnum = pgEnum("modification_status", [
  "APPLIED",
  "AWAITING_PAYMENT",
  "CANCELLED",
]);
export const notificationChannelEnum = pgEnum("notification_channel", ["EMAIL", "WHATSAPP"]);
export const deliveryStatusEnum = pgEnum("notification_delivery_status", ["NOT_CONFIGURED", "QUEUED", "SENT", "FAILED"]);
