"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/server/db";
import { savedAddress } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/guard";
import { checkoutSchema, CheckoutError, createOrderAndStartPayment, findOrderByPhone, retryOrderPayment } from "@/server/services/orders";
import { loadCatalogForBranch } from "@/server/services/catalog";
import { priceLine, PricingError } from "@/server/services/pricing-core";
import { clientIp, rateLimit } from "@/server/services/rate-limit";
import { PaymentProviderError } from "@/server/paystack/provider";
import { eq } from "drizzle-orm";
import { order } from "@/server/db/schema";

const quoteSchema = z.object({
  branchId: z.string().uuid(),
  items: z.array(z.object({ key: z.string(), productId: z.string().uuid(), optionIds: z.array(z.string().uuid()), quantity: z.number().int().min(1).max(50) })).max(40),
});

/** Server-side price check for the cart (display); the real charge is recomputed again when the order is placed. */
export async function quoteCart(raw: unknown) {
  const p = quoteSchema.safeParse(raw);
  if (!p.success) return { lines: [], problems: [] as { key: string; message: string }[] };
  const catalog = await loadCatalogForBranch(db, p.data.branchId, p.data.items.map((i) => i.productId));
  const lines: { key: string; unitPriceKobo: number; lineTotalKobo: number }[] = [];
  const problems: { key: string; message: string }[] = [];
  for (const i of p.data.items) {
    try {
      const l = priceLine(catalog.get(i.productId), i);
      lines.push({ key: i.key, unitPriceKobo: l.unitPriceKobo, lineTotalKobo: l.lineTotalKobo });
    } catch (e) {
      problems.push({ key: i.key, message: e instanceof PricingError ? e.message : "This item can't be ordered." });
    }
  }
  return { lines, problems };
}

export type PlaceOrderResult = { ok: true; redirectUrl: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function placeOrder(raw: unknown): Promise<PlaceOrderResult> {
  const ip = await clientIp();
  if (!(await rateLimit(`checkout:${ip}`, 12, 600))) return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const user = await getCurrentUser();
  const customerId = user && user.role === "CUSTOMER" ? user.id : null;
  try {
    const r = await createOrderAndStartPayment(parsed.data, customerId);
    (await cookies()).set(`ce_trk_${r.reference}`, r.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, secure: process.env.APP_URL?.startsWith("https") });
    if (customerId && parsed.data.type === "DELIVERY" && parsed.data.saveAddress && parsed.data.address) {
      await db.insert(savedAddress).values({ userId: customerId, label: "Saved address", address: parsed.data.address, landmark: parsed.data.landmark || null, instructions: parsed.data.instructions || null });
    }
    return { ok: true, redirectUrl: r.authorizationUrl };
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: e.message, fieldErrors: e.field ? { [e.field]: e.message } : undefined };
    if (e instanceof PaymentProviderError) return { ok: false, error: `Payment could not be started: ${e.message}` };
    console.error("placeOrder failed", e);
    return { ok: false, error: "Something went wrong placing your order. You have not been charged. Please try again." };
  }
}

/** Retry payment from the tracking page (requires the guest token cookie or ownership). */
export async function payAgain(reference: string): Promise<PlaceOrderResult> {
  const o = await db.query.order.findFirst({ where: eq(order.reference, reference) });
  if (!o) return { ok: false, error: "Order not found" };
  const token = (await cookies()).get(`ce_trk_${o.reference}`)?.value;
  const user = await getCurrentUser();
  const { sha256 } = await import("@/lib/ids");
  const allowed = (token && sha256(token) === o.trackingTokenHash) || (user && o.customerUserId === user.id);
  if (!allowed) return { ok: false, error: "Open this order from the link on this device, or sign in." };
  try {
    const r = await retryOrderPayment(o.id);
    return { ok: true, redirectUrl: r.authorizationUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not start payment" };
  }
}

export async function lookupOrder(_: unknown, form: FormData): Promise<{ error?: string; redirect?: string }> {
  const ip = await clientIp();
  if (!(await rateLimit(`lookup:${ip}`, 10, 600))) return { error: "Too many lookups. Try again in a few minutes." };
  const ref = String(form.get("reference") ?? "").trim().toUpperCase();
  const phone = String(form.get("phone") ?? "");
  if (!ref || !phone) return { error: "Enter your order reference and phone number." };
  const o = await findOrderByPhone(ref, phone);
  if (!o) return { error: "We couldn't find an order with that reference and phone number." };
  // Grant this browser access to the order page via a short-lived signed cookie of the lookup.
  const { sha256 } = await import("@/lib/ids");
  (await cookies()).set(`ce_lkp_${o.reference}`, sha256(o.trackingTokenHash + process.env.BETTER_AUTH_SECRET), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 6 });
  return { redirect: `/order/${o.reference}` };
}
