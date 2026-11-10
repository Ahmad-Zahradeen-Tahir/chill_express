"use client";
import Link from "next/link";
import { useActionState } from "react";
import { customerRegister, customerSignIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/form";

export function SignInForm({ next }: { next?: string }) {
  const [s, action, pending] = useActionState(customerSignIn, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      {s.error && <Alert tone="error">{s.error}</Alert>}
      <Button type="submit" variant="red" size="lg" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      <p className="text-center text-sm text-ink-3">New here? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-red">Create an account</Link></p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [s, action, pending] = useActionState(customerRegister, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Full name"><Input name="name" autoComplete="name" required /></Field>
      <Field label="Phone number"><Input name="phone" type="tel" autoComplete="tel" placeholder="+234…" required /></Field>
      <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" hint="At least 8 characters"><Input name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
      {s.error && <Alert tone="error">{s.error}</Alert>}
      <Button type="submit" variant="red" size="lg" className="w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
      <p className="text-center text-sm text-ink-3">Already have an account? <Link href="/login" className="font-semibold text-brand-red">Sign in</Link></p>
    </form>
  );
}
