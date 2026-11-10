"use server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { branch } from "@/server/db/schema";

const BRANCH_COOKIE = "ce_branch";

export async function selectBranch(branchId: string) {
  const b = await db.query.branch.findFirst({ where: eq(branch.id, branchId), columns: { id: true } });
  if (!b) return { ok: false as const };
  (await cookies()).set(BRANCH_COOKIE, b.id, { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax", httpOnly: false });
  return { ok: true as const };
}
