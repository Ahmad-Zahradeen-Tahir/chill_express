"use client";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const h = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2200);
    };
    window.addEventListener("ce:toast", h);
    return () => window.removeEventListener("ce:toast", h);
  }, []);
  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lg">
        <CheckCircle2 className="size-5 text-brand-orange" /> {msg}
        <button className="ml-2 text-brand-orange underline" onClick={() => window.dispatchEvent(new Event("ce:open-cart"))}>View cart</button>
      </div>
    </div>
  );
}
