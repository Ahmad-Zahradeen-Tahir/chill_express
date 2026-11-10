import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { devSimRecord } from "@/server/db/schema";

type SimTxn = { reference: string; amountKobo: number; outcome: "pending" | "success" | "failed" };
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
};
