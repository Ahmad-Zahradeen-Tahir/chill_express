"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { lookupOrder } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/form";

export function TrackForm({ initialRef }: { initialRef: string }) {
  const [state, action, pending] = useActionState(lookupOrder, {});
  const router = useRouter();
  useEffect(() => {
    if (state.redirect) router.push(state.redirect);
  }, [state, router]);
  return (
    <form action={action} className="mt-6 space-y-4 rounded-3xl bg-white p-6 shadow-card">
      <Field label="Order reference"><Input name="reference" defaultValue={initialRef} placeholder="CE-GR-XXXXXX" required className="uppercase" /></Field>
      <Field label="Phone number"><Input name="phone" type="tel" placeholder="+234…" required /></Field>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" variant="red" size="lg" className="w-full" disabled={pending}>{pending ? "Looking up…" : "Track order"}</Button>
    </form>
  );
}
