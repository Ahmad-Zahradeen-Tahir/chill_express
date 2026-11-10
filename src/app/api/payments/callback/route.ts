import { NextResponse, type NextRequest } from "next/server";
import { confirmPayment } from "@/server/services/payments";

/** Paystack redirects the customer here after checkout. We verify server-side before showing anything. */
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference") || req.nextUrl.searchParams.get("trxref");
  const base = process.env.APP_URL || req.nextUrl.origin;
  if (!reference) return NextResponse.redirect(new URL("/track", base));
  try {
    const r = await confirmPayment(reference, "callback");
    if (r.kind === "not_found") return NextResponse.redirect(new URL("/track?e=notfound", base));
    const q = r.kind === "failed" ? "?payment=failed" : r.kind === "pending" ? "?payment=pending" : "?payment=ok";
    return NextResponse.redirect(new URL(`/order/${r.orderReference}${q}`, base));
  } catch (e) {
    console.error("payment callback verify failed", e);
    return NextResponse.redirect(new URL(`/track?e=verify`, base));
  }
}
