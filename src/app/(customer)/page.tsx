import Image from "next/image";
import { InstagramIcon } from "@/components/ui/icons";
import Link from "next/link";
import { ArrowRight, Camera, Gift, MapPin, Phone, Clock } from "lucide-react";
import { getMenu, getPopularProductIds } from "@/server/services/catalog";
import { getBranchesWithState, getSelectedBranchId, getSettings } from "@/server/services/site";
import { ButtonLink } from "@/components/ui/button";
import { BranchPicker } from "@/components/customer/branch-picker";
import { ProductCard } from "@/components/customer/product-card";
import { Toaster } from "@/components/customer/toaster";
import { formatNaira } from "@/lib/money";
import { DAY_NAMES } from "@/server/services/branch-hours";

export default async function HomePage() {
  const [branchId, branches, settings] = await Promise.all([getSelectedBranchId(), getBranchesWithState(), getSettings()]);
  const [menu, popularIds] = await Promise.all([getMenu(branchId), getPopularProductIds()]);
  const branch = branches.find((b) => b.id === branchId) ?? null;
  const all = menu.flatMap((c) => c.products);
  const featured = all.filter((p) => p.featured).slice(0, 4);
  const popular = popularIds.map((id) => all.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const pickerBranches = branches.map((b) => ({ id: b.id, name: b.name, address: b.address, blockReason: b.blockReason }));
  const blocked = branch?.blockReason ?? null;

  const catImage: Record<string, string> = {
    shawarma: "/images/placeholders/shawarma.svg",
    burgers: "/images/brand/burger.jpg",
    "loaded-fries": "/images/brand/loaded-fries.jpg",
    beverages: "/images/brand/store-slush.jpg",
  };

  return (
    <>
      {/* HERO */}
      <section className="dots relative overflow-hidden bg-brand-orange">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 md:grid-cols-[1.1fr_1fr] md:pb-24 md:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-brand-red">
              <MapPin className="size-4" /> Maiduguri · Gombole Road & Lagos Street
            </p>
            <h1 className="mt-5 font-display text-[clamp(3.5rem,11vw,7.5rem)] font-extrabold uppercase leading-[0.85] text-ink">
              Hungry?
              <br />
              <span className="text-brand-red">Chill.</span>{" "}
              <span className="text-white [-webkit-text-stroke:2px_var(--color-ink)]">Order.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-ink-2">Shawarma, burgers, loaded fries and frosty drinks. Order online for pickup or delivery and pay securely with Paystack.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/menu" variant="red" size="lg">Order now <ArrowRight className="size-5" /></ButtonLink>
              <ButtonLink href="#explore" variant="white" size="lg">Explore menu</ButtonLink>
            </div>
            <div className="mt-8 max-w-md">
              <BranchPicker branches={pickerBranches} selectedId={branchId} variant="big" />
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div className="absolute inset-0 rotate-3 rounded-[2.5rem] bg-brand-red" />
            <div className="absolute inset-0 -rotate-2 overflow-hidden rounded-[2.5rem] shadow-2xl ring-8 ring-white">
              <Image src="/images/brand/burger.jpg" alt="Chill. Express burger" fill priority sizes="(max-width: 768px) 90vw, 450px" className="object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-4 w-40 rotate-[-8deg] overflow-hidden rounded-3xl shadow-xl ring-4 ring-white sm:w-48">
              <div className="relative aspect-[3/4]"><Image src="/images/brand/store-slush.jpg" alt="Frosty drink at Chill. Express" fill sizes="200px" className="object-cover" /></div>
            </div>
            <div className="absolute -right-3 -top-4 grid size-28 rotate-12 place-items-center rounded-full bg-ink text-center font-display text-xl font-bold uppercase leading-none text-brand-orange shadow-xl">
              Pickup
              <br />
              or
              <br />
              Delivery
            </div>
          </div>
        </div>
      </section>

      {/* EXPLORE */}
      <section id="explore" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-5xl font-extrabold uppercase leading-none">Explore the menu</h2>
          <Link href="/menu" className="hidden items-center gap-1 font-semibold text-brand-red hover:underline sm:flex">Full menu <ArrowRight className="size-4" /></Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {menu.map((c) => {
            const min = Math.min(...c.products.map((p) => p.basePriceKobo));
            return (
              <Link key={c.id} href={`/menu?c=${c.slug}`} className="group relative aspect-[3/4] overflow-hidden rounded-3xl bg-ink">
                <Image src={catImage[c.slug] ?? "/images/placeholders/fries.svg"} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover opacity-80 transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <h3 className="font-display text-3xl font-extrabold uppercase leading-none">{c.name}</h3>
                  <p className="mt-1 text-sm text-white/80">From {formatNaira(min)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* FEATURED */}
      {featured.length > 0 && (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <p className="font-semibold uppercase tracking-wider text-brand-red">Chill picks</p>
            <h2 className="font-display text-5xl font-extrabold uppercase leading-none">Featured</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((p) => (
                <ProductCard key={p.id} p={p} branchSelected={!!branch} orderingBlocked={blocked} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PROMO — from the official menu board */}
      <section className="dots bg-brand-red text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-[auto_1fr_auto]">
          <div className="grid size-20 place-items-center rounded-full bg-brand-orange text-ink"><Gift className="size-10" /></div>
          <div>
            <p className="font-display text-lg font-bold uppercase tracking-wider text-brand-orange">Snap & tag offer</p>
            <h2 className="font-display text-4xl font-extrabold uppercase leading-none md:text-5xl">Take a snap of your order and tag us on Instagram</h2>
            <p className="mt-3 text-lg text-white/90">Get a <strong>FREE gift</strong> on your next purchase.</p>
          </div>
          <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white px-6 font-semibold text-brand-red hover:bg-orange-50">
            <Camera className="size-5" /> {settings.instagram}
          </a>
        </div>
      </section>

      {/* POPULAR */}
      {popular.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <p className="font-semibold uppercase tracking-wider text-brand-red">Based on recent orders</p>
          <h2 className="font-display text-5xl font-extrabold uppercase leading-none">Most ordered</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((p) => (
              <ProductCard key={p.id} p={p} branchSelected={!!branch} orderingBlocked={blocked} />
            ))}
          </div>
        </section>
      )}

      {/* GALLERY */}
      <section className="bg-ink py-16 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-5xl font-extrabold uppercase leading-none">Fresh from the counter</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["/images/brand/loaded-fries-slush.jpg", "Loaded fries and a frosty drink"],
              ["/images/brand/grilled-sandwich.jpg", "Grilled sandwich"],
              ["/images/brand/chicken-bowl.jpg", "Chicken bowl"],
              ["/images/brand/loaded-fries.jpg", "Loaded fries"],
              ["/images/brand/sandwich-drink.jpg", "Sandwich and drink"],
              ["/images/brand/store-slush.jpg", "Inside Chill. Express"],
              ["/images/brand/burger.jpg", "Burger"],
              ["/images/brand/menu-board.png", "Our menu board"],
            ].map(([src, alt], i) => (
              <div key={src} className={`relative overflow-hidden rounded-2xl ${i % 3 === 0 ? "aspect-[3/4]" : "aspect-square"}`}>
                <Image src={src} alt={alt} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRANCHES + CONTACT */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-5xl font-extrabold uppercase leading-none">Our branches</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {branches.map((b) => {
            const configured = b.hours.some((h) => h.opens);
            return (
              <div key={b.id} className="dots-ink rounded-3xl bg-white p-6 shadow-card ring-1 ring-ink/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-4xl font-extrabold uppercase leading-none">{b.name}</h3>
                    <p className="mt-1 text-ink-3">{b.address || "Maiduguri, Borno State"}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${b.blockReason ? "bg-red-50 text-brand-red" : "bg-success-50 text-success"}`}>
                    {b.blockReason ? "Not taking orders" : "Taking orders"}
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-sm">
                  {b.pickupEnabled && <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold">Pickup</span>}
                  {b.deliveryEnabled && <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold">Delivery · {formatNaira(b.deliveryFeeKobo)}</span>}
                </div>
                {configured && (
                  <ul className="mt-4 grid grid-cols-2 gap-x-4 text-sm text-ink-2">
                    {b.hours.map((h) => (
                      <li key={h.dayOfWeek} className="flex justify-between gap-2"><span className="inline-flex items-center gap-1"><Clock className="size-3" />{DAY_NAMES[h.dayOfWeek].slice(0, 3)}</span><span>{h.closed ? "Closed" : `${h.opens}–${h.closes}`}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-3xl bg-brand-orange p-8 md:flex-row md:items-center">
          <div>
            <h3 className="font-display text-4xl font-extrabold uppercase leading-none">Prefer to call?</h3>
            <p className="mt-1 text-ink-2">Questions about an order? Reach us directly.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={settings.phoneHref} className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 font-semibold text-white hover:bg-ink-2"><Phone className="size-5" /> {settings.phone}</a>
            <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 font-semibold text-brand-red hover:bg-orange-50"><InstagramIcon className="size-5" /> {settings.instagram}</a>
          </div>
        </div>
      </section>
      <Toaster />
    </>
  );
}
