import "server-only";
import { and, desc, eq, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/server/db";
import { notification, notificationDelivery, notificationRead } from "@/server/db/schema";
import type { Permission, StaffContext } from "@/server/auth/permissions";

export async function notifyStaff(
  tx: DbOrTx,
  n: {
    type: string;
    title: string;
    body?: string;
    link?: string;
    orderId?: string | null;
    branchId?: string | null;
    permissionKey: Permission;
  },
) {
  await tx.insert(notification).values({
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    orderId: n.orderId ?? null,
    branchId: n.branchId ?? null,
    permissionKey: n.permissionKey,
  });
}

/**
 * Outbound customer messages. No email/WhatsApp provider is configured yet, so every message is
 * recorded with status NOT_CONFIGURED. Nothing claims that a message was sent.
 */
export type CustomerChannel = {
  channel: "EMAIL" | "WHATSAPP";
  configured(): boolean;
  send(to: string, template: string, payload: Record<string, unknown>): Promise<void>;
};

const channels: CustomerChannel[] = [
  { channel: "EMAIL", configured: () => false, send: async () => {} },
  { channel: "WHATSAPP", configured: () => false, send: async () => {} },
];

export async function messageCustomer(
  tx: DbOrTx,
  o: { id: string; customerEmail: string | null; customerPhone: string },
  template: string,
  payload: Record<string, unknown>,
) {
  for (const ch of channels) {
    const to = ch.channel === "EMAIL" ? o.customerEmail : o.customerPhone;
    if (!to) continue;
    await tx.insert(notificationDelivery).values({
      orderId: o.id,
      channel: ch.channel,
      recipient: to,
      template,
      payload,
      status: ch.configured() ? "QUEUED" : "NOT_CONFIGURED",
    });
  }
}

function visibilityFilter(ctx: StaffContext) {
  const perms = [...ctx.permissions];
  const branchCond =
    ctx.branchIds === null
      ? undefined
      : or(isNull(notification.branchId), ctx.branchIds.length ? inArray(notification.branchId, ctx.branchIds) : sql`false`);
  return or(
    eq(notification.recipientUserId, ctx.userId),
    and(isNull(notification.recipientUserId), perms.length ? inArray(notification.permissionKey, perms) : sql`false`, branchCond),
  );
}

/** The user's notification inbox: only notifications they have not yet opened or cleared. */
export async function listNotifications(ctx: StaffContext, limit = 50) {
  const rows = await db
    .select({
      n: notification,
      readAt: notificationRead.readAt,
    })
    .from(notification)
    .leftJoin(notificationRead, and(eq(notificationRead.notificationId, notification.id), eq(notificationRead.userId, ctx.userId)))
    .where(and(visibilityFilter(ctx), isNull(notificationRead.readAt)))
    .orderBy(desc(notification.createdAt))
    .limit(limit);
  return rows.map((r) => r.n);
}

export async function unreadCount(ctx: StaffContext) {
  const [r] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notification)
    .where(
      and(
        visibilityFilter(ctx),
        notExists(
          db
            .select({ x: sql`1` })
            .from(notificationRead)
            .where(and(eq(notificationRead.notificationId, notification.id), eq(notificationRead.userId, ctx.userId))),
        ),
      ),
    );
  return r?.c ?? 0;
}

/** "Mark all read": clears every visible notification from this user's inbox (single INSERT … SELECT). */
export async function markAllRead(ctx: StaffContext) {
  await db
    .insert(notificationRead)
    .select(
      db
        .select({ notificationId: notification.id, userId: sql<string>`${ctx.userId}`.as("user_id"), readAt: sql<Date>`now()`.as("read_at") })
        .from(notification)
        .where(visibilityFilter(ctx)),
    )
    .onConflictDoNothing();
}

/** Mark specific notifications read for this user (only ones they can see). */
export async function markRead(ctx: StaffContext, ids: string[]) {
  if (!ids.length) return 0;
  const rows = await db.select({ id: notification.id }).from(notification).where(and(visibilityFilter(ctx), inArray(notification.id, ids)));
  if (!rows.length) return 0;
  const res = await db
    .insert(notificationRead)
    .values(rows.map((r) => ({ notificationId: r.id, userId: ctx.userId })))
    .onConflictDoNothing()
    .returning({ id: notificationRead.notificationId });
  return res.length;
}
