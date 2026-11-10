import type { Metadata } from "next";
import { SignInForm } from "@/components/customer/auth-forms";
export const metadata: Metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-6xl font-extrabold uppercase leading-none">Sign in</h1>
      <p className="mb-6 mt-2 text-ink-3">Track orders, reorder faster and save your delivery addresses. You can also check out as a guest.</p>
      <div className="rounded-3xl bg-white p-6 shadow-card"><SignInForm next={next} /></div>
    </div>
  );
}
