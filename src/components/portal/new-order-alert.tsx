"use client";
import { BellRing, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Plays a chime and flashes the tab title when the number of orders awaiting approval goes up. */
export function NewOrderAlert({ pendingIds }: { pendingIds: string[] }) {
  const seen = useRef<Set<string> | null>(null);
  const sound = useSyncExternalStore(subscribeSound, readSound, () => false);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(pendingIds);
      return;
    }
    const fresh = pendingIds.filter((id) => !seen.current!.has(id));
    pendingIds.forEach((id) => seen.current!.add(id));
    if (fresh.length) {
      setFlash(fresh.length);
      if (sound) chime();
      const orig = document.title;
      document.title = `(${fresh.length}) NEW ORDER · Chill. Express`;
      const t = setTimeout(() => (document.title = orig), 8000);
      return () => clearTimeout(t);
    }
  }, [pendingIds, sound]);

  function toggle() {
    const next = !sound;
    try {
      localStorage.setItem("ce-sound", next ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event("ce-sound"));
    if (next) chime();
  }

  return (
    <div className="flex items-center gap-2">
      {flash > 0 && (
        <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-brand-red px-3 py-1.5 text-xs font-bold text-white">
          <BellRing className="size-4" /> {flash} new order{flash > 1 ? "s" : ""}
        </span>
      )}
      <button onClick={toggle} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-line" aria-pressed={sound}>
        {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} Sound {sound ? "on" : "off"}
      </button>
    </div>
  );
}

function subscribeSound(cb: () => void) {
  window.addEventListener("ce-sound", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("ce-sound", cb);
    window.removeEventListener("storage", cb);
  };
}
function readSound() {
  try {
    return localStorage.getItem("ce-sound") === "1";
  } catch {
    return false;
  }
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1175, 1568].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.15 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.15);
      o.stop(ctx.currentTime + i * 0.15 + 0.45);
    });
  } catch {}
}
