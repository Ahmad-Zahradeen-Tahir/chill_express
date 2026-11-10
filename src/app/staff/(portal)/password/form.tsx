"use client";
import { useActionState } from "react";
import { changeOwnPassword } from "@/app/actions/staff-admin";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/form";

export function PasswordForm() {
  const [s, action, pending] = useActionState(changeOwnPassword, {});
  return (
    <form action={action} className="space-y-4 rounded-3xl bg-white p-6 ring-1 ring-line">
      <Field label="Current password"><Input name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label="New password"><Input name="next" type="password" autoComplete="new-password" minLength={10} required /></Field>
      {s.error && <Alert tone="error">{s.error}</Alert>}
      {s.ok && <Alert tone="success">Password changed.</Alert>}
      <Button type="submit" variant="dark" disabled={pending}>Change password</Button>
    </form>
  );
}
