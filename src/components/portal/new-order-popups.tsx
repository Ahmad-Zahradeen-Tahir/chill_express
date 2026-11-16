"use client";
import { BellRing, Bike, Store, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { NewOrderPopup } from "@/app/api/staff/new-orders/route";
import { Button } from "@/components/ui/button";
import { acknowledgeNewOrder } from "@/app/actions/staff-orders";
import { audioBlocked, ring, unlockAudio } from "@/lib/client/order-sound";

const POLL_MS = 8000;

function readAcked(key: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}
function writeAcked(key: string, ids: Iterable<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {}
}

const timeAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
};

/**
 * Cashier alert: a popup for every new paid order, each closed with "Okay".
 * Several at once are stacked with the oldest on top. Acknowledged orders are remembered on this device.
 */
export function NewOrderPopups({ userId }: { userId: string }) {
  const key = `ce-new-order-ack:${userId}`;
  const [queue, setQueue] = useState<NewOrderPopup[]>([]);
  const shown = useRef<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const router = useRouter();

  // Browsers allow sound only after a click or keypress on the page; unlock on the first one.
  useEffect(() => {
    const onInteract = () => unlockAudio().then(() => setMuted(audioBlocked()));
    window.addEventListener("pointerdown", onInteract);
    window.addEventListener("keydown", onInteract);
    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, []);

  const poll = useCallback(async () => {
    let orders: NewOrderPopup[];
    try {
      const res = await fetch("/api/staff/new-orders", { cache: "no-store" });
      if (!res.ok) return;
      orders = await res.json();
    } catch {
      return;
    }
    const ids = orders.map((o) => o.id);
    const acked = readAcked(key);
    if (acked === null) {
      // First time on this device: orders already waiting are on the queue; only new ones pop up.
      writeAcked(key, ids);
      return;
    }
    // Forget orders that are no longer waiting, so the stored list stays small.
    writeAcked(key, ids.filter((id) => acked.has(id)));
    const next = orders.filter((o) => !acked.has(o.id));
    const fresh = next.filter((o) => !shown.current.has(o.id));
    next.forEach((o) => shown.current.add(o.id));
    if (fresh.length) {
      await unlockAudio();
      ring();
      setMuted(audioBlocked());
      router.refresh();
    }
    setQueue(next);
  }, [key, router]);

  useEffect(() => {
    const first = setTimeout(poll, 0);
    const t = setInterval(poll, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [poll]);

  function okay(id: string) {
    const acked = readAcked(key) ?? new Set<string>();
    acked.add(id);
    writeAcked(key, acked);
    setQueue((q) => q.filter((o) => o.id !== id));
    // Also clear its "New paid order" notification; the sidebar badge refreshes with it.
    acknowledgeNewOrder(id).catch(() => {});
  }

  if (!queue.length) return null;
  const [top, ...rest] = queue;
  const behind = rest.slice(0, 2);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="new-order-title">
      <div className="relative w-full max-w-sm pb-6">
        {/* Newer orders peek out underneath; the oldest is on top. */}
        {behind.map((o, i) => (
          <div
            key={o.id}
            aria-hidden
            className="absolute inset-x-0 top-0 bottom-6 rounded-3xl bg-white shadow-card ring-1 ring-line"
            style={{ transform: `translateY(${(i + 1) * 12}px) scale(${1 - (i + 1) * 0.05})`, transformOrigin: "bottom center", zIndex: 2 - i, opacity: 1 - (i + 1) * 0.25 }}
          />
        ))}
        <section key={top.id} className="relative z-10 overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-ink/10">
          <div className="flex items-center justify-between bg-brand-orange px-5 py-3">
            <h2 id="new-order-title" className="flex items-center gap-2 font-display text-2xl font-extrabold uppercase">
              <BellRing className="size-6 text-brand-red" /> New order
            </h2>
            {queue.length > 1 && <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white">1 of {queue.length}</span>}
          </div>
          <div className="p-5">
            <p className="font-display text-3xl font-bold leading-none">{top.reference}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-3">
              {top.type === "DELIVERY" ? <Bike className="size-4" /> : <Store className="size-4" />}
              {top.type === "DELIVERY" ? "Delivery" : "Pickup ASAP"} · {top.branchName} · {timeAgo(top.createdAt)}
            </p>
            <ul className="mt-4 space-y-1 rounded-2xl bg-paper p-3 text-sm">
              {top.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between text-sm">
              <span className="text-ink-3">{top.customerName}</span>
              <strong className="text-base">{top.total}</strong>
            </p>
            {muted && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-ink-2">
                <VolumeX className="mt-0.5 size-4 shrink-0 text-brand-red" />
                Your browser blocked the sound for this order. After you press Okay, new orders will ring.
              </p>
            )}
            <Button variant="red" size="lg" className="mt-5 w-full" autoFocus onClick={() => okay(top.id)}>
              Okay
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
