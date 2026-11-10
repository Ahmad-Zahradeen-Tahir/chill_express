"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-render server data periodically (polling; host-neutral alternative to websockets). */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
