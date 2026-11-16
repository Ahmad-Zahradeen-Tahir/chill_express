"use client";
import { BellRing, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { chime, unlockAudio } from "@/lib/client/order-sound";

/**
 * Plays a chime and flashes the tab title when the number of orders awaiting approval goes up.
 * `silent` (cashiers) skips the chime and hides the toggle: their new-order popups always ring.
 */
export function NewOrderAlert({ pendingIds, silent = false }: { pendingIds: string[]; silent?: boolean }) {
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
      if (sound && !silent) chime();
      const orig = document.title;
      document.title = `(${fresh.length}) NEW ORDER · Chill. Express`;
      const t = setTimeout(() => (document.title = orig), 8000);
      return () => clearTimeout(t);
    }
  }, [pendingIds, sound, silent]);

  function toggle() {
    const next = !sound;
    try {
      localStorage.setItem("ce-sound", next ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event("ce-sound"));
    if (next) unlockAudio().then(chime);
  }

  return (
    <div className="flex items-center gap-2">
      {flash > 0 && (
        <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-brand-red px-3 py-1.5 text-xs font-bold text-white">
          <BellRing className="size-4" /> {flash} new order{flash > 1 ? "s" : ""}
        </span>
      )}
      {!silent && <button onClick={toggle} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-line" aria-pressed={sound}>
        {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} Sound {sound ? "on" : "off"}
      </button>}
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
