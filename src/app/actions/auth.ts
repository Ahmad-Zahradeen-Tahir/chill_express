"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { isStaffRole } from "@/server/auth/permissions";
import { clientIp, rateLimit } from "@/server/services/rate-limit";

type State = { error?: string };

function safeNext(n: FormDataEntryValue | null, fallback: string) {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

export async function customerSignIn(_: State, form: FormData): Promise<State> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  if (!(await rateLimit(`signin:${ip}:${email}`, 6, 300)) || !(await rateLimit(`signin-ip:${ip}`, 40, 300))) return { error: "Too many attempts. Wait a few minutes." };
  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (e) {
    return { error: e instanceof APIError ? (e.body?.message ?? "Invalid email or password") : "Sign-in failed" };
  }
  const u = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (u && isStaffRole(u.role)) redirect("/staff");
  redirect(safeNext(form.get("next"), "/account"));
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,18}$/, "Enter a valid phone number"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function customerRegister(_: State, form: FormData): Promise<State> {
  if (!(await rateLimit(`register:${await clientIp()}`, 5, 600))) return { error: "Too many attempts. Wait a few minutes." };
  const p = registerSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    await auth.api.signUpEmail({ body: { name: p.data.name, email: p.data.email, password: p.data.password, phone: p.data.phone }, headers: await headers() });
  } catch (e) {
    return { error: e instanceof APIError ? (e.body?.message ?? "Could not create account") : "Could not create account" };
  }
  redirect(safeNext(form.get("next"), "/account"));
}

export async function staffSignIn(_: State, form: FormData): Promise<State> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  // Per account+IP limit stops brute force on one account; the looser IP-wide limit stops password spraying.
  if (!(await rateLimit(`staff-signin:${ip}:${email}`, 6, 300)) || !(await rateLimit(`staff-signin-ip:${ip}`, 40, 300))) return { error: "Too many attempts. Wait a few minutes." };
  const u = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (!u || !isStaffRole(u.role)) return { error: "Invalid staff email or password" };
  if (u.status === "SUSPENDED") return { error: "This account is suspended. Contact the CEO." };
  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (e) {
    return { error: e instanceof APIError ? (e.body?.message ?? "Invalid staff email or password") : "Sign-in failed" };
  }
  redirect(u.mustChangePassword ? "/staff/password" : u.role === "CEO" ? "/admin" : "/staff");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export async function staffSignOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/staff/login");
}
