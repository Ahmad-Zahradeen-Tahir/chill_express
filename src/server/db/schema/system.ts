import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { branch } from "./branches";
import { deliveryStatusEnum, notificationChannelEnum } from "./enums";
import { order } from "./orders";

/**
 * In-app notification. Either addressed to one user (recipientUserId) or to everyone
 * holding `permissionKey` with access to `branchId` (null branch = company-wide).
 */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientUserId: text("recipient_user_id").references(() => user.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key"),
    branchId: uuid("branch_id").references(() => branch.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => order.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notification_created_idx").on(t.createdAt), index("notification_branch_idx").on(t.branchId)],
);

export const notificationRead = pgTable(
  "notification_read",
  {
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notification.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notification_read_uq").on(t.notificationId, t.userId)],
);

/** Outbound customer messages (email / WhatsApp). Recorded honestly as NOT_CONFIGURED until a provider exists. */
export const notificationDelivery = pgTable(
  "notification_delivery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => order.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    recipient: text("recipient").notNull(),
    template: text("template").notNull(),
    payload: jsonb("payload").notNull(),
    status: deliveryStatusEnum("status").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notification_delivery_order_idx").on(t.orderId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorLabel: text("actor_label"), // e.g. "system", "paystack-webhook"
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    branchId: uuid("branch_id").references(() => branch.id, { onDelete: "set null" }),
    data: jsonb("data"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entity, t.entityId),
    index("audit_created_idx").on(t.createdAt),
  ],
);

export const rateLimit = pgTable("rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

/** Backing store for the clearly-labelled payment SIMULATOR only (PAYMENTS_DRIVER=dev-sim). Never used with Paystack. */
export const devSimRecord = pgTable("dev_sim_record", {
  key: text("key").primaryKey(), // "txn:<reference>"
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
