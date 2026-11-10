import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guard";
import { listNotifications } from "@/server/services/notifications";
import { timeAgo } from "@/server/services/staff-view";
import { markNotificationsRead } from "@/app/actions/staff-orders";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { MarkSeen } from "@/components/portal/mark-seen";

export default async function NotificationsPage() {
  const ctx = await requireStaffPage("notifications.view");
  const list = await listNotifications(ctx, 100);
  return (
    <div className="max-w-3xl">
      <AutoRefresh seconds={15} />
      <MarkSeen ids={list.filter((n) => !n.read).map((n) => n.id)} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">Notifications</h1>
        <form action={markNotificationsRead}><Button size="sm" variant="outline">Mark all read</Button></form>
      </div>
      <p className="text-sm text-ink-3">Only events for your branches and permissions are shown.</p>
      <ul className="mt-6 space-y-2">
        {list.map((n) => (
          <li key={n.id}>
            <Link href={n.link ?? "#"} className={cn("block rounded-2xl bg-white p-4 ring-1 hover:ring-brand-orange", n.read ? "ring-line" : "ring-brand-orange")}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{!n.read && <span className="mr-2 inline-block size-2 rounded-full bg-brand-red" />}{n.title}</p>
                <span className="shrink-0 text-xs text-ink-3">{timeAgo(n.createdAt)}</span>
              </div>
              {n.body && <p className="mt-0.5 text-sm text-ink-3">{n.body}</p>}
            </Link>
          </li>
        ))}
        {!list.length && <li className="py-10 text-center text-ink-3">No notifications yet.</li>}
      </ul>
    </div>
  );
}
