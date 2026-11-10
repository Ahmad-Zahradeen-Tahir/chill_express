import Link from "next/link";
import { Bell, BarChart3, ClipboardList, FileText, LayoutGrid, LogOut, Store, Users, UtensilsCrossed, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ROLE_LABELS, type Permission, type StaffContext } from "@/server/auth/permissions";
import { staffSignOut } from "@/app/actions/auth";
import { unreadCount } from "@/server/services/notifications";
import { isSimulatedPayments } from "@/server/paystack/provider";
import { NavLink } from "./nav-link";
import { db } from "@/server/db";
import { branch } from "@/server/db/schema";
import { inArray } from "drizzle-orm";

const NAV: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; perm: Permission | Permission[]; group: "ops" | "admin" }[] = [
  { href: "/staff", label: "Live queue", icon: LayoutGrid, perm: "orders.view", group: "ops" },
  { href: "/staff/orders", label: "All orders", icon: ClipboardList, perm: "orders.view", group: "ops" },
  { href: "/staff/notifications", label: "Notifications", icon: Bell, perm: "notifications.view", group: "ops" },
  { href: "/admin", label: "Executive dashboard", icon: BarChart3, perm: "analytics.view", group: "admin" },
  { href: "/admin/reports", label: "Reports", icon: FileText, perm: "reports.export", group: "admin" },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed, perm: ["menu.manage", "menu.availability"], group: "admin" },
  { href: "/admin/branches", label: "Branches", icon: Store, perm: "branches.manage", group: "admin" },
  { href: "/admin/staff", label: "Staff", icon: Users, perm: "staff.manage", group: "admin" },
  { href: "/admin/audit", label: "Audit log", icon: ShieldCheck, perm: "staff.manage", group: "admin" },
];

export async function PortalShell({ ctx, children }: { ctx: StaffContext; children: React.ReactNode }) {
  const can = (p: Permission | Permission[]) => (Array.isArray(p) ? p.some((x) => ctx.permissions.has(x)) : ctx.permissions.has(p));
  const items = NAV.filter((n) => can(n.perm));
  const [unread, branches] = await Promise.all([
    unreadCount(ctx),
    ctx.branchIds === null ? Promise.resolve(null) : ctx.branchIds.length ? db.select({ name: branch.name }).from(branch).where(inArray(branch.id, ctx.branchIds)) : Promise.resolve([]),
  ]);
  const scope = branches === null ? "All branches" : branches.map((b) => b.name).join(", ") || "No branch assigned";
  const sim = isSimulatedPayments();
  const group = (g: "ops" | "admin") =>
    items
      .filter((i) => i.group === g)
      .map((i) => (
        <NavLink key={i.href} href={i.href} exact={i.href === "/staff" || i.href === "/admin"}>
          <i.icon className="size-4.5" /> <span className="flex-1">{i.label}</span>
          {i.href === "/staff/notifications" && unread > 0 && <span className="rounded-full bg-brand-red px-1.5 text-[11px] font-bold text-white">{unread}</span>}
        </NavLink>
      ));
  return (
    <div className="min-h-dvh bg-[#f6f3ef] lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-5 lg:py-5">
          <Link href="/staff"><Logo className="h-8" /></Link>
          <p className="hidden text-[11px] font-semibold uppercase tracking-wider text-ink-3 lg:mt-1 lg:block">Management portal</p>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-0.5 lg:px-3">
          {group("ops")}
          {items.some((i) => i.group === "admin") && <p className="hidden px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-3 lg:block">Management</p>}
          {group("admin")}
        </nav>
        <div className="hidden border-t border-line p-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <p className="truncate text-sm font-semibold">{ctx.name}</p>
          <p className="truncate text-xs text-ink-3">{ROLE_LABELS[ctx.role]} · {scope}</p>
          <form action={staffSignOut} className="mt-2"><button className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-brand-red"><LogOut className="size-3.5" /> Sign out</button></form>
        </div>
      </aside>
      <div className="min-w-0">
        {sim && <div className="bg-ink px-4 py-1.5 text-center text-xs font-semibold text-brand-orange">DEMO MODE: payments are simulated (no Paystack keys configured).</div>}
        <div className="flex items-center justify-between gap-2 border-b border-line bg-white px-4 py-2 text-xs text-ink-3 lg:hidden">
          <span className="truncate">{ctx.name} · {ROLE_LABELS[ctx.role]} · {scope}</span>
          <form action={staffSignOut}><button className="font-semibold text-brand-red">Sign out</button></form>
        </div>
        <div className="mx-auto max-w-[1400px] p-4 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
