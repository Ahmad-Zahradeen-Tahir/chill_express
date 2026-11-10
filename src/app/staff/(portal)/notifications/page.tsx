import { requireStaffPage } from "@/server/auth/guard";
import { listNotifications } from "@/server/services/notifications";
import { timeAgo } from "@/server/services/staff-view";
import { markNotificationsRead } from "@/app/actions/staff-orders";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "@/components/portal/notification-item";

export default async function NotificationsPage() {
  const ctx = await requireStaffPage("notifications.view");
  const list = await listNotifications(ctx, 100);
  return (
    <div className="max-w-3xl">
      <AutoRefresh seconds={15} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">Notifications</h1>
        {list.length > 0 && <form action={markNotificationsRead}><Button size="sm" variant="outline">Mark all read</Button></form>}
      </div>
      <p className="text-sm text-ink-3">Only events for your branches and permissions are shown. Click a notification to open it and clear it.</p>
      <ul className="mt-6 space-y-2">
        {list.map((n) => (
          <li key={n.id}>
            <NotificationItem id={n.id} title={n.title} body={n.body} link={n.link} when={timeAgo(n.createdAt)} />
          </li>
        ))}
        {!list.length && <li className="py-10 text-center text-ink-3">You&apos;re all caught up. No unread notifications.</li>}
      </ul>
    </div>
  );
}
