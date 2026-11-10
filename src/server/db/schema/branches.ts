import { boolean, integer, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const branch = pgTable("branch", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  code: text("code").notNull().unique(), // short code used in order references, e.g. GR / LS
  name: text("name").notNull(),
  address: text("address"), // null = not yet provided by the business
  phone: text("phone"),
  isOpen: boolean("is_open").notNull().default(true), // false = temporarily closed
  closedMessage: text("closed_message"),
  acceptingOrders: boolean("accepting_orders").notNull().default(true),
  pickupEnabled: boolean("pickup_enabled").notNull().default(true),
  deliveryEnabled: boolean("delivery_enabled").notNull().default(true),
  deliveryFeeKobo: integer("delivery_fee_kobo").notNull().default(0),
  prepTimeMins: integer("prep_time_mins").notNull().default(20),
  enforceHours: boolean("enforce_hours").notNull().default(false), // only enforce once hours are configured
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const branchHours = pgTable(
  "branch_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branch.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(), // 0 = Sunday
    opens: text("opens"), // "HH:MM" (Africa/Lagos)
    closes: text("closes"),
    closed: boolean("closed").notNull().default(false),
  },
  (t) => [unique("branch_hours_day_uq").on(t.branchId, t.dayOfWeek)],
);

export const siteSetting = pgTable("site_setting", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
