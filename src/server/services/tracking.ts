import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { order } from "@/server/db/schema";
import { sha256 } from "@/lib/ids";
import { getCurrentUser } from "@/server/auth/guard";

/** Resolve whether the current visitor may view an order: token link, tracking cookie, phone lookup cookie, or owner account. */
export async function getTrackableOrder(reference: string, tokenParam?: string | null) {
  const ref = reference.toUpperCase();
  const o = await db.query.order.findFirst({ where: eq(order.reference, ref) });
  if (!o) return { order: null, allowed: false as const };
  const jar = await cookies();
  const token = tokenParam || jar.get(`ce_trk_${ref}`)?.value;
  if (token && sha256(token) === o.trackingTokenHash) return { order: o, allowed: true as const, token };
  const lkp = jar.get(`ce_lkp_${ref}`)?.value;
  if (lkp && lkp === sha256(o.trackingTokenHash + process.env.BETTER_AUTH_SECRET)) return { order: o, allowed: true as const };
  const u = await getCurrentUser();
  if (u && o.customerUserId === u.id) return { order: o, allowed: true as const };
  return { order: o, allowed: false as const };
}
