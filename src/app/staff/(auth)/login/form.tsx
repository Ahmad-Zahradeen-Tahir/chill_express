"use client";
import { useActionState } from "react";
import { staffSignIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/form";

export function StaffLoginForm() {
  const [s, action, pending] = useActionState(staffSignIn, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Work email"><Input name="email" type="email" autoComplete="username" required /></Field>
      <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      {s.error && <Alert tone="error">{s.error}</Alert>}
      <Button type="submit" variant="dark" size="lg" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
