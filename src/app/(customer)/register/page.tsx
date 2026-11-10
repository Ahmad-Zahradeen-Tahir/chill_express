import type { Metadata } from "next";
import { RegisterForm } from "@/components/customer/auth-forms";
export const metadata: Metadata = { title: "Create account" };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-6xl font-extrabold uppercase leading-none">Join Chill.</h1>
      <p className="mb-6 mt-2 text-ink-3">An account is optional. Guest checkout always works.</p>
      <div className="rounded-3xl bg-white p-6 shadow-card"><RegisterForm next={next} /></div>
    </div>
  );
}
