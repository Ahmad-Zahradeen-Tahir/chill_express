"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { openNotification } from "@/app/actions/staff-orders";
import { cn } from "@/lib/cn";

/** A notification in the inbox. Clicking it marks it read (removing it from the inbox) and opens its link. */
export function NotificationItem({ id, title, body, link, when }: { id: string; title: string; body: string | null; link: string | null; when: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const open = () =>
    start(async () => {
      await openNotification(id);
      if (link) router.push(link);
      else router.refresh();
    });
  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className={cn("block w-full rounded-2xl bg-white p-4 text-left ring-1 ring-brand-orange transition hover:ring-2", pending && "opacity-60")}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="font-semibold"><span className="mr-2 inline-block size-2 rounded-full bg-brand-red" />{title}</span>
        <span className="shrink-0 text-xs text-ink-3">{when}</span>
      </span>
      {body && <span className="mt-0.5 block text-sm text-ink-3">{body}</span>}
    </button>
  );
}
