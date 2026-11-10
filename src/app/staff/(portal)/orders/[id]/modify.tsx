"use client";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { staffModifyOrder } from "@/app/actions/staff-orders";
import type { MenuCategory } from "@/server/services/catalog";
import { formatNaira } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";

type Line = { existingItemId: string | null; productId: string; name: string; options: string; optionIds: string[]; unitPriceKobo: number; quantity: number };

export function ModifyOrder({
  order,
  delivery,
  items,
  menu,
}: {
  order: { id: string; type: "PICKUP" | "DELIVERY"; customerName: string; customerPhone: string; customerEmail: string | null; pickupTime: string | null; totalKobo: number; deliveryFeeKobo: number };
  delivery: { address: string; landmark: string | null; instructions: string | null } | null;
  items: { id: string; productId: string | null; name: string; options: string; optionIds: string[]; unitPriceKobo: number; quantity: number }[];
  menu: MenuCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>(items.filter((i) => i.productId).map((i) => ({ existingItemId: i.id, productId: i.productId!, name: i.name, options: i.options, optionIds: i.optionIds, unitPriceKobo: i.unitPriceKobo, quantity: i.quantity })));
  const [cust, setCust] = useState({ customerName: order.customerName, customerPhone: order.customerPhone, customerEmail: order.customerEmail ?? "", pickupTime: order.pickupTime ?? "ASAP" });
  const [del, setDel] = useState({ address: delivery?.address ?? "", landmark: delivery?.landmark ?? "", instructions: delivery?.instructions ?? "" });
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const products = menu.flatMap((c) => c.products);
  const [addId, setAddId] = useState("");
  const [addOpts, setAddOpts] = useState<Record<string, string>>({});
  const addProduct = products.find((p) => p.id === addId);

  const newTotal = useMemo(() => lines.reduce((s, l) => s + l.unitPriceKobo * l.quantity, 0) + order.deliveryFeeKobo, [lines, order.deliveryFeeKobo]);
  const delta = newTotal - order.totalKobo;

  function addLine() {
    if (!addProduct) return;
    const chosen = addProduct.groups.flatMap((g) => g.options.filter((o) => addOpts[g.id] === o.id));
    if (addProduct.groups.some((g) => g.required && !addOpts[g.id])) return setResult({ tone: "error", text: "Choose all required options for the new item." });
    setLines((ls) => [...ls, { existingItemId: null, productId: addProduct.id, name: addProduct.name, options: chosen.map((o) => o.name).join(" · "), optionIds: chosen.map((o) => o.id), unitPriceKobo: addProduct.basePriceKobo + chosen.reduce((s, o) => s + o.priceDeltaKobo, 0), quantity: 1 }]);
    setAddId("");
    setAddOpts({});
  }

  function submit() {
    setResult(null);
    start(async () => {
      const r = await staffModifyOrder({
        orderId: order.id,
        reason,
        customerName: cust.customerName,
        customerPhone: cust.customerPhone,
        customerEmail: cust.customerEmail || null,
        pickupTime: order.type === "PICKUP" ? cust.pickupTime : null,
        delivery: order.type === "DELIVERY" ? { address: del.address, landmark: del.landmark || null, instructions: del.instructions || null } : null,
        items: lines.map((l) => ({ existingItemId: l.existingItemId, productId: l.productId, optionIds: l.optionIds, quantity: l.quantity })),
      });
      setResult(r.ok ? { tone: "success", text: r.message ?? "Saved" } : { tone: "error", text: r.error });
      if (r.ok) setOpen(false);
    });
  }

  if (!open)
    return (
      <Card className="flex items-center justify-between p-5">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase">Modify order</h2>
          <p className="text-sm text-ink-3">Change items, quantities or customer details. Price changes are settled through Paystack.</p>
          {result && <Alert tone={result.tone} className="mt-2">{result.text}</Alert>}
        </div>
        <Button variant="outline" onClick={() => setOpen(true)}>Edit</Button>
      </Card>
    );

  return (
    <Card className="p-5">
      <h2 className="font-display text-2xl font-bold uppercase">Modify order</h2>
      <ul className="mt-3 space-y-2">
        {lines.map((l, idx) => (
          <li key={idx} className="flex items-center justify-between gap-3 rounded-xl bg-paper p-3 text-sm">
            <span className="min-w-0"><strong>{l.name}</strong>{l.options && <span className="block text-xs text-ink-3">{l.options}</span>}{!l.existingItemId && <span className="text-xs font-semibold text-success"> new</span>}</span>
            <span className="flex items-center gap-2">
              <button onClick={() => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))} className="grid size-7 place-items-center rounded-full bg-white ring-1 ring-line" aria-label="Decrease"><Minus className="size-3.5" /></button>
              <span className="w-5 text-center font-bold">{l.quantity}</span>
              <button onClick={() => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, quantity: Math.min(50, x.quantity + 1) } : x)))} className="grid size-7 place-items-center rounded-full bg-white ring-1 ring-line" aria-label="Increase"><Plus className="size-3.5" /></button>
              <span className="w-20 text-right font-semibold">{formatNaira(l.unitPriceKobo * l.quantity)}</span>
              <button onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} className="text-ink-3 hover:text-brand-red" aria-label="Remove item"><Trash2 className="size-4" /></button>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-line p-3 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-2 sm:grid-cols-3">
          <Select value={addId} onChange={(e) => { setAddId(e.target.value); setAddOpts({}); }}>
            <option value="">Add an item…</option>
            {products.filter((p) => p.available).map((p) => <option key={p.id} value={p.id}>{p.name} ({formatNaira(p.basePriceKobo)})</option>)}
          </Select>
          {addProduct?.groups.map((g) => (
            <Select key={g.id} value={addOpts[g.id] ?? ""} onChange={(e) => setAddOpts((o) => ({ ...o, [g.id]: e.target.value }))}>
              <option value="">{g.name}{g.required ? " (required)" : " (optional)"}</option>
              {g.options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.priceDeltaKobo ? ` +${formatNaira(o.priceDeltaKobo)}` : ""}</option>)}
            </Select>
          ))}
        </div>
        <Button variant="dark" size="md" onClick={addLine} disabled={!addProduct}>Add</Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Customer name"><Input value={cust.customerName} onChange={(e) => setCust({ ...cust, customerName: e.target.value })} /></Field>
        <Field label="Phone"><Input value={cust.customerPhone} onChange={(e) => setCust({ ...cust, customerPhone: e.target.value })} /></Field>
        <Field label="Email"><Input value={cust.customerEmail} onChange={(e) => setCust({ ...cust, customerEmail: e.target.value })} /></Field>
        {order.type === "PICKUP" && <Field label="Pickup time"><Input value={cust.pickupTime} onChange={(e) => setCust({ ...cust, pickupTime: e.target.value })} /></Field>}
        {order.type === "DELIVERY" && (
          <>
            <Field label="Address" className="sm:col-span-2"><Input value={del.address} onChange={(e) => setDel({ ...del, address: e.target.value })} /></Field>
            <Field label="Landmark"><Input value={del.landmark} onChange={(e) => setDel({ ...del, landmark: e.target.value })} /></Field>
            <Field label="Delivery instructions"><Input value={del.instructions} onChange={(e) => setDel({ ...del, instructions: e.target.value })} /></Field>
          </>
        )}
        <Field label="Reason for change (recorded in audit log)" className="sm:col-span-2"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer called to add a soda" /></Field>
      </div>

      <div className="mt-4 rounded-xl bg-paper p-3 text-sm">
        <div className="flex justify-between"><span>Current total</span><span>{formatNaira(order.totalKobo)}</span></div>
        <div className="flex justify-between font-bold"><span>New total</span><span>{formatNaira(newTotal)}</span></div>
        <p className={`mt-1 font-semibold ${delta > 0 ? "text-[#7a4a00]" : delta < 0 ? "text-success" : "text-ink-3"}`}>
          {delta > 0 ? `Customer must pay ${formatNaira(delta)} extra through Paystack. The order is held until it is verified.` : delta < 0 ? `${formatNaira(-delta)} will be refunded through Paystack.` : "No price change."}
        </p>
        <p className="text-xs text-ink-3">Final amounts are recalculated on the server. Existing items keep the price the customer paid.</p>
      </div>
      {result && <Alert tone={result.tone} className="mt-3">{result.text}</Alert>}
      <div className="mt-4 flex gap-2">
        <Button variant="red" onClick={submit} disabled={pending || reason.trim().length < 3 || !lines.length}>{pending ? "Saving…" : "Save changes"}</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Card>
  );
}
