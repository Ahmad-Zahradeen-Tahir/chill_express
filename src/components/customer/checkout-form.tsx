"use client";
import { Bike, Lock, ShoppingBag, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { placeOrder, quoteCart } from "@/app/actions/checkout";
import { useCart, useCartHydrated } from "@/lib/client/cart-store";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/cn";
import { Button, buttonClass } from "@/components/ui/button";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";

type Branch = { id: string; name: string; deliveryFeeKobo: number; pickupEnabled: boolean; deliveryEnabled: boolean; blockReason: string | null; prepTimeMins: number };
type Addr = { id: string; label: string; address: string; landmark: string | null; instructions: string | null };

export function CheckoutForm({ branch, customer, addresses, simulated }: { branch: Branch | null; customer: { name: string; email: string; phone: string | null } | null; addresses: Addr[]; simulated: boolean }) {
  const { items, branchId, remove } = useCart();
  const hydrated = useCartHydrated();
  const [type, setType] = useState<"PICKUP" | "DELIVERY">(branch?.pickupEnabled === false ? "DELIVERY" : "PICKUP");
  const [form, setForm] = useState({
    customerName: customer?.name ?? "",
    customerPhone: customer?.phone ?? "",
    customerEmail: customer?.email ?? "",
    pickupTime: "ASAP",
    address: addresses[0]?.address ?? "",
    landmark: addresses[0]?.landmark ?? "",
    instructions: addresses[0]?.instructions ?? "",
    saveAddress: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [quote, setQuote] = useState<{ lines: { key: string; lineTotalKobo: number; unitPriceKobo: number }[]; problems: { key: string; message: string }[] } | null>(null);

  const itemsSig = JSON.stringify(items.map((i) => [i.key, i.quantity]));
  useEffect(() => {
    if (!branch || !items.length) return;
    let live = true;
    quoteCart({ branchId: branch.id, items: items.map((i) => ({ key: i.key, productId: i.productId, optionIds: i.optionIds, quantity: i.quantity })) }).then((q) => live && setQuote(q));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id, itemsSig]);

  const subtotal = useMemo(() => {
    if (!quote) return items.reduce((s, i) => s + i.unitPriceKobo * i.quantity, 0);
    return quote.lines.reduce((s, l) => s + l.lineTotalKobo, 0);
  }, [quote, items]);
  const fee = type === "DELIVERY" && branch ? branch.deliveryFeeKobo : 0;
  const problems = quote?.problems ?? [];

  if (!hydrated) return <div className="py-20 text-center text-ink-3">Loading your cart…</div>;
  if (!items.length)
    return (
      <div className="mt-10 rounded-3xl bg-white p-10 text-center shadow-card">
        <ShoppingBag className="mx-auto size-12 text-ink-3" />
        <p className="mt-3 font-display text-3xl font-bold">Your cart is empty</p>
        <Link href="/menu" className={buttonClass("red", "md", "mt-5")}>Browse the menu</Link>
      </div>
    );
  if (!branch || (branchId && branchId !== branch.id))
    return <Alert tone="warn" className="mt-8">Please choose your branch using the branch button at the top of the page, then come back to checkout.</Alert>;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    start(async () => {
      const r = await placeOrder({
        branchId: branch!.id,
        type,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
        pickupTime: type === "PICKUP" ? form.pickupTime : null,
        address: type === "DELIVERY" ? form.address : null,
        landmark: type === "DELIVERY" ? form.landmark : null,
        instructions: type === "DELIVERY" ? form.instructions : null,
        saveAddress: form.saveAddress,
        items: items.map((i) => ({ productId: i.productId, optionIds: i.optionIds, quantity: i.quantity })),
      });
      if (r.ok) {
        useCart.getState().clear();
        window.location.href = r.redirectUrl;
      } else {
        setError(r.error);
        setErrors(r.fieldErrors ?? {});
      }
    });
  }

  const pickupSlots = ["ASAP", ...Array.from({ length: 12 }, (_, i) => `${String(10 + i).padStart(2, "0")}:00`), ...Array.from({ length: 12 }, (_, i) => `${String(10 + i).padStart(2, "0")}:30`)].sort((a, b) => (a === "ASAP" ? -1 : b === "ASAP" ? 1 : a.localeCompare(b)));

  return (
    <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {branch.blockReason && <Alert tone="error">{branch.blockReason}</Alert>}
        <section className="rounded-3xl bg-white p-6 shadow-card">
          <h2 className="font-display text-2xl font-bold uppercase">1. How do you want it?</h2>
          <p className="text-sm text-ink-3">From <strong className="text-ink">{branch.name}</strong></p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {([
              ["PICKUP", "Pickup", Store, branch.pickupEnabled, "Collect at the branch"],
              ["DELIVERY", "Delivery", Bike, branch.deliveryEnabled, `${formatNaira(branch.deliveryFeeKobo)} delivery fee`],
            ] as const).map(([v, label, Icon, enabled, sub]) => (
              <button
                key={v}
                type="button"
                disabled={!enabled}
                onClick={() => setType(v)}
                aria-pressed={type === v}
                className={cn("rounded-2xl border-2 p-4 text-left transition-colors disabled:opacity-40", type === v ? "border-brand-red bg-red-50" : "border-line hover:border-brand-orange")}
              >
                <Icon className={cn("size-6", type === v ? "text-brand-red" : "text-ink-3")} />
                <span className="mt-2 block font-display text-2xl font-bold">{label}</span>
                <span className="text-xs text-ink-3">{enabled ? sub : "Not available right now"}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-card">
          <h2 className="font-display text-2xl font-bold uppercase">2. Your details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={errors.customerName}><Input value={form.customerName} onChange={set("customerName")} autoComplete="name" required /></Field>
            <Field label="Phone number" error={errors.customerPhone}><Input value={form.customerPhone} onChange={set("customerPhone")} type="tel" autoComplete="tel" placeholder="+234…" required /></Field>
            <Field label="Email" error={errors.customerEmail} hint="Paystack sends your payment receipt here." className="sm:col-span-2"><Input value={form.customerEmail} onChange={set("customerEmail")} type="email" autoComplete="email" required /></Field>
            {type === "PICKUP" && (
              <Field label="Pickup time" error={errors.pickupTime} hint={`Usually ready in about ${branch.prepTimeMins} minutes after we confirm.`}>
                <Select value={form.pickupTime} onChange={set("pickupTime")}>
                  {pickupSlots.map((s) => <option key={s} value={s}>{s === "ASAP" ? "As soon as possible" : `Today at ${s}`}</option>)}
                </Select>
              </Field>
            )}
          </div>
        </section>

        {type === "DELIVERY" && (
          <section className="rounded-3xl bg-white p-6 shadow-card">
            <h2 className="font-display text-2xl font-bold uppercase">3. Delivery address</h2>
            {addresses.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {addresses.map((a) => (
                  <button key={a.id} type="button" onClick={() => setForm((f) => ({ ...f, address: a.address, landmark: a.landmark ?? "", instructions: a.instructions ?? "" }))} className="rounded-full bg-paper px-3 py-1.5 text-sm font-semibold ring-1 ring-line hover:ring-brand-orange">
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 grid gap-4">
              <Field label="Address" error={errors.address}><Textarea value={form.address} onChange={set("address")} autoComplete="street-address" rows={2} /></Field>
              <Field label="Nearest landmark" error={errors.landmark}><Input value={form.landmark} onChange={set("landmark")} /></Field>
              <Field label="Delivery instructions (optional)" error={errors.instructions}><Textarea value={form.instructions} onChange={set("instructions")} rows={2} /></Field>
              {customer && (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.saveAddress} onChange={set("saveAddress")} className="size-4 accent-brand-red" /> Save this address to my account</label>
              )}
            </div>
          </section>
        )}
      </div>

      <aside className="h-fit space-y-4 lg:sticky lg:top-24">
        <div className="rounded-3xl bg-white p-6 shadow-card">
          <h2 className="font-display text-2xl font-bold uppercase">Order summary</h2>
          <ul className="mt-4 divide-y divide-line">
            {items.map((i) => {
              const q = quote?.lines.find((l) => l.key === i.key);
              const prob = problems.find((p) => p.key === i.key);
              return (
                <li key={i.key} className="py-3">
                  <div className="flex justify-between gap-3 text-sm">
                    <span><strong>{i.quantity}×</strong> {i.name}{i.optionLabels.length > 0 && <span className="block text-xs text-ink-3">{i.optionLabels.join(" · ")}</span>}</span>
                    <span className="font-semibold">{formatNaira(q?.lineTotalKobo ?? i.unitPriceKobo * i.quantity)}</span>
                  </div>
                  {prob && (
                    <p className="mt-1 text-xs font-semibold text-brand-red">
                      {prob.message} <button type="button" className="underline" onClick={() => remove(i.key)}>Remove</button>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-ink-3">Subtotal</dt><dd>{formatNaira(subtotal)}</dd></div>
            {type === "DELIVERY" && <div className="flex justify-between"><dt className="text-ink-3">Delivery</dt><dd>{formatNaira(fee)}</dd></div>}
            <div className="flex justify-between pt-2 text-lg font-bold"><dt>Total</dt><dd>{formatNaira(subtotal + fee)}</dd></div>
          </dl>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" variant="red" size="lg" className="w-full" disabled={pending || problems.length > 0 || !!branch.blockReason}>
          <Lock className="size-5" /> {pending ? "Starting secure payment…" : `Pay ${formatNaira(subtotal + fee)} with Paystack`}
        </Button>
        <p className="text-center text-xs text-ink-3">
          {simulated ? "Demo mode: you will see a SIMULATED payment page. No real money moves." : "You'll be redirected to Paystack to pay securely. Your order is sent to the kitchen for approval once payment is confirmed."}
        </p>
      </aside>
    </form>
  );
}
