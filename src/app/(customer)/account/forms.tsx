"use client";
import { Trash2 } from "lucide-react";
import { useActionState, useTransition } from "react";
import { addAddress, deleteAddress, updateProfile } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/form";

export function AccountForms({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [ps, pAction, pPending] = useActionState(updateProfile, {});
  const [as, aAction, aPending] = useActionState(addAddress, {});
  return (
    <>
      <form action={pAction} className="space-y-3 rounded-3xl bg-white p-6 shadow-card">
        <h2 className="font-display text-2xl font-bold uppercase">Profile</h2>
        <p className="text-sm text-ink-3">{email}</p>
        <Field label="Name"><Input name="name" defaultValue={name} required /></Field>
        <Field label="Phone"><Input name="phone" defaultValue={phone} type="tel" required /></Field>
        {ps.error && <Alert tone="error">{ps.error}</Alert>}
        {ps.ok && <Alert tone="success">Profile saved.</Alert>}
        <Button type="submit" size="sm" variant="dark" disabled={pPending}>Save profile</Button>
      </form>
      <form action={aAction} className="space-y-3 rounded-3xl bg-white p-6 shadow-card">
        <h2 className="font-display text-2xl font-bold uppercase">Add address</h2>
        <Field label="Label"><Input name="label" placeholder="Home, Office…" required /></Field>
        <Field label="Address"><Input name="address" required /></Field>
        <Field label="Landmark"><Input name="landmark" /></Field>
        <Field label="Instructions"><Input name="instructions" /></Field>
        {as.error && <Alert tone="error">{as.error}</Alert>}
        <Button type="submit" size="sm" variant="dark" disabled={aPending}>Save address</Button>
      </form>
    </>
  );
}

export function DeleteAddressButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => deleteAddress(id))} className="text-ink-3 hover:text-brand-red" aria-label="Delete address">
      <Trash2 className="size-4" />
    </button>
  );
}
