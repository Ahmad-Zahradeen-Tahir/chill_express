import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { reconcilePayments } from "@/server/services/payments";
import { reconcileRefunds } from "@/server/services/refunds";

/** Called by system cron (Hostinger) or `npm run reconcile`. Protected by CRON_SECRET bearer token. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const got = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  const ok = secret.length > 0 && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const payments = await reconcilePayments();
  const refunds = await reconcileRefunds();
  return NextResponse.json({ payments, refunds });
}
