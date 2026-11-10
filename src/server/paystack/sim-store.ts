import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { devSimRecord } from "@/server/db/schema";
import { randomCode } from "@/lib/ids";

type SimTxn = { reference: string; amountKobo: number; outcome: "pending" | "success" | "failed" };
type SimRefund = {
  id: string;
  transactionReference: string;
  amountKobo: number;
  status: "pending" | "processing" | "processed" | "failed";
  createdAt: string;
};

/** Simulated refunds settle a few seconds after creation (checked on fetch), mimicking Paystack's async refunds. */
const SIM_REFUND_SETTLE_MS = 5_000;

async function get<T>(key: string): Promise<T | null> {
  const r = await db.query.devSimRecord.findFirst({ where: eq(devSimRecord.key, key) });
  return (r?.data as T) ?? null;
}
async function put(key: string, data: unknown) {
  await db
    .insert(devSimRecord)
    .values({ key, data })
    .onConflictDoUpdate({ target: devSimRecord.key, set: { data, updatedAt: new Date() } });
}

export const simStore = {
  async createTxn(reference: string, amountKobo: number) {
    await put(`txn:${reference}`, { reference, amountKobo, outcome: "pending" } satisfies SimTxn);
  },
  getTxn: (reference: string) => get<SimTxn>(`txn:${reference}`),
  async setOutcome(reference: string, outcome: "success" | "failed") {
    const t = await get<SimTxn>(`txn:${reference}`);
    if (!t) return null;
    if (t.outcome !== "pending") return t; // outcome is final, like a real transaction
    const next = { ...t, outcome };
    await put(`txn:${reference}`, next);
    return next;
  },
  async createRefund(transactionReference: string, amountKobo: number) {
    const id = `SIMRF_${randomCode(10)}`;
    await put(`refund:${id}`, {
      id,
      transactionReference,
      amountKobo,
      status: "pending",
      createdAt: new Date().toISOString(),
    } satisfies SimRefund);
    return id;
  },
  async getRefund(id: string) {
    const r = await get<SimRefund>(`refund:${id}`);
    if (!r) return null;
    if (r.status === "pending" && Date.now() - Date.parse(r.createdAt) > SIM_REFUND_SETTLE_MS) {
      const next = { ...r, status: "processed" as const };
      await put(`refund:${id}`, next);
      return next;
    }
    return r;
  },
};
