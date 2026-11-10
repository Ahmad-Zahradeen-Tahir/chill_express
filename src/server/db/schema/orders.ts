import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { branch } from "./branches";
import { product } from "./menu";
import {
  modificationStatusEnum,
  orderPaymentStatusEnum,
  orderStatusEnum,
  orderTypeEnum,
  paymentProviderEnum,
  paymentPurposeEnum,
  paymentTxnStatusEnum,
} from "./enums";

export type OrderItemOptionSnapshot = { groupName: string; optionName: string; priceDeltaKobo: number; optionId: string };

export const order = pgTable(
  "order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branch.id, { onDelete: "restrict" }),
    customerUserId: text("customer_user_id").references(() => user.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    type: orderTypeEnum("type").notNull(),
    subtotalKobo: integer("subtotal_kobo").notNull(),
    deliveryFeeKobo: integer("delivery_fee_kobo").notNull().default(0),
    totalKobo: integer("total_kobo").notNull(),
    paidKobo: integer("paid_kobo").notNull().default(0), // sum of verified successful payments
    status: orderStatusEnum("status").notNull().default("AWAITING_PAYMENT"),
    statusBeforeHold: orderStatusEnum("status_before_hold"),
    paymentStatus: orderPaymentStatusEnum("payment_status").notNull().default("UNPAID"),
    trackingTokenHash: text("tracking_token_hash").notNull(),
    staffNote: text("staff_note"),
    isDemo: boolean("is_demo").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("order_branch_status_created_idx").on(t.branchId, t.status, t.createdAt),
    index("order_payment_status_idx").on(t.paymentStatus),
    index("order_customer_idx").on(t.customerUserId),
    index("order_created_idx").on(t.createdAt),
    check("order_amounts_nonneg", sql`${t.totalKobo} >= 0 AND ${t.paidKobo} >= 0`),
  ],
);

export const orderItem = pgTable(
  "order_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => product.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    categoryName: text("category_name").notNull(),
    unitPriceKobo: integer("unit_price_kobo").notNull(), // base + option deltas, snapshot
    options: jsonb("options").$type<OrderItemOptionSnapshot[]>().notNull().default([]),
    quantity: integer("quantity").notNull(),
    lineTotalKobo: integer("line_total_kobo").notNull(),
  },
  (t) => [
    index("order_item_order_idx").on(t.orderId),
    index("order_item_product_idx").on(t.productId),
    check("order_item_qty_pos", sql`${t.quantity} > 0`),
  ],
);

export const deliveryInfo = pgTable("delivery_info", {
  orderId: uuid("order_id")
    .primaryKey()
    .references(() => order.id, { onDelete: "cascade" }),
  address: text("address").notNull(),
  landmark: text("landmark"),
  instructions: text("instructions"),
});

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("osh_order_idx").on(t.orderId, t.createdAt)],
);

export const payment = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "restrict" }),
    modificationId: uuid("modification_id"),
    purpose: paymentPurposeEnum("purpose").notNull().default("ORDER"),
    provider: paymentProviderEnum("provider").notNull(),
    reference: text("reference").notNull().unique(),
    amountKobo: integer("amount_kobo").notNull(),
    currency: text("currency").notNull().default("NGN"),
    status: paymentTxnStatusEnum("status").notNull().default("INITIALIZED"),
    authorizationUrl: text("authorization_url"),
    providerTransactionId: text("provider_transaction_id"),
    channel: text("channel"),
    failureReason: text("failure_reason"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payment_order_idx").on(t.orderId),
    index("payment_status_idx").on(t.status, t.createdAt),
    check("payment_amount_pos", sql`${t.amountKobo} > 0`),
  ],
);

export const orderModification = pgTable(
  "order_modification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    reason: text("reason"),
    before: jsonb("before").notNull(),
    after: jsonb("after").notNull(),
    deltaKobo: integer("delta_kobo").notNull(),
    status: modificationStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("order_mod_order_idx").on(t.orderId)],
);

export const webhookEvent = pgTable("webhook_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  eventKey: text("event_key").notNull().unique(), // sha256 of raw body -> idempotency
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
