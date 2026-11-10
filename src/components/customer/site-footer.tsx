import Link from "next/link";
import { InstagramIcon } from "@/components/ui/icons";
import { Phone } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import type { SiteSettings } from "@/server/services/site";

export function SiteFooter({ settings, branches }: { settings: SiteSettings; branches: { id: string; name: string; address: string | null }[] }) {
  return (
    <footer className="dots relative bg-brand-red text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo variant="white" className="h-12" />
          <p className="mt-4 text-sm text-white/80">Maiduguri, Borno State</p>
        </div>
        <div>
          <h3 className="font-display text-xl font-bold uppercase tracking-wide text-brand-orange">Order</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/menu" className="hover:underline">Full menu</Link></li>
            <li><Link href="/track" className="hover:underline">Track an order</Link></li>
            <li><Link href="/account" className="hover:underline">My account</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-xl font-bold uppercase tracking-wide text-brand-orange">Branches</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {branches.map((b) => (
              <li key={b.id}>
                <span className="font-semibold">{b.name}</span>
                {b.address && <span className="block text-white/75">{b.address}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-display text-xl font-bold uppercase tracking-wide text-brand-orange">Contact</h3>
          <ul className="mt-3 space-y-3 text-sm">
            <li><a href={settings.phoneHref} className="inline-flex items-center gap-2 hover:underline"><Phone className="size-4" /> {settings.phone}</a></li>
            <li><a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:underline"><InstagramIcon className="size-4" /> {settings.instagram}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-white/70">
          <span>© {new Date().getFullYear()} Chill. Express. Payments secured by Paystack.</span>
          <Link href="/staff/login" className="hover:text-white">Staff portal</Link>
        </div>
      </div>
    </footer>
  );
}
