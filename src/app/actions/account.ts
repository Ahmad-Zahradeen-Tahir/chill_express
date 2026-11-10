"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { savedAddress, user } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/guard";

async function me() {
  const u = await getCurrentUser();
  if (!u || u.role !== "CUSTOMER") throw new Error("Sign in required");
  return u;
}

export async function updateProfile(_: unknown, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  const u = await me();
  const p = z
    .object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,18}$/, "Enter a valid phone number") })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  await db.update(user).set({ name: p.data.name, phone: p.data.phone, updatedAt: new Date() }).where(eq(user.id, u.id));
  revalidatePath("/account");
  return { ok: true };
}

export async function addAddress(_: unknown, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  const u = await me();
  const p = z
    .object({ label: z.string().trim().min(1).max(40), address: z.string().trim().min(5).max(300), landmark: z.string().trim().max(200).optional(), instructions: z.string().trim().max(500).optional() })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  await db.insert(savedAddress).values({ userId: u.id, label: p.data.label, address: p.data.address, landmark: p.data.landmark || null, instructions: p.data.instructions || null });
  revalidatePath("/account");
  return { ok: true };
}

export async function deleteAddress(id: string) {
  const u = await me();
  await db.delete(savedAddress).where(and(eq(savedAddress.id, id), eq(savedAddress.userId, u.id)));
  revalidatePath("/account");
}
