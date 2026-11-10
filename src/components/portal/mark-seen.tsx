"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { markNotificationsSeen } from "@/app/actions/staff-orders";

/** Marks notifications read once the user has opened them, then refreshes so the unread badge updates. */
export function MarkSeen({ ids, orderId }: { ids?: string[]; orderId?: string }) {
  const router = useRouter();
  const key = (ids ?? []).join(",");
  useEffect(() => {
    if (!key && !orderId) return;
    let cancelled = false;
    markNotificationsSeen({ ids: key ? key.split(",") : undefined, orderId }).then((n) => {
      if (n > 0 && !cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [key, orderId, router]);
  return null;
}
