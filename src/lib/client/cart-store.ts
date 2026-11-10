"use client";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  key: string; // productId + sorted optionIds
  productId: string;
  name: string;
  imageUrl: string | null;
  optionIds: string[];
  optionLabels: string[];
  /** Display only. The server re-prices everything at checkout. */
  unitPriceKobo: number;
  quantity: number;
};

type CartState = {
  branchId: string | null;
  items: CartItem[];
  add: (item: Omit<CartItem, "key" | "quantity">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setBranch: (branchId: string | null) => void;
  replaceUnavailable: (productIds: string[]) => void;
};

export const cartKey = (productId: string, optionIds: string[]) => `${productId}:${[...optionIds].sort().join(",")}`;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      branchId: null,
      items: [],
      add: (item, qty = 1) =>
        set((s) => {
          const key = cartKey(item.productId, item.optionIds);
          const existing = s.items.find((i) => i.key === key);
          if (existing) {
            return { items: s.items.map((i) => (i.key === key ? { ...i, quantity: Math.min(50, i.quantity + qty) } : i)) };
          }
          return { items: [...s.items, { ...item, key, quantity: qty }] };
        }),
      setQty: (key, qty) =>
        set((s) => ({
          items: qty <= 0 ? s.items.filter((i) => i.key !== key) : s.items.map((i) => (i.key === key ? { ...i, quantity: Math.min(50, qty) } : i)),
        })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
      setBranch: (branchId) => set({ branchId }),
      replaceUnavailable: (productIds) => set((s) => ({ items: s.items.filter((i) => !productIds.includes(i.productId)) })),
    }),
    {
      name: "ce-cart-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ branchId: s.branchId, items: s.items }),
    },
  ),
);

export function cartCount(items: CartItem[]) {
  return items.reduce((s, i) => s + i.quantity, 0);
}
export function cartSubtotal(items: CartItem[]) {
  return items.reduce((s, i) => s + i.unitPriceKobo * i.quantity, 0);
}

/** True once the persisted cart has been loaded from localStorage (always false during SSR). */
export function useCartHydrated() {
  return useSyncExternalStore(
    (cb) => useCart.persist.onFinishHydration(cb),
    () => useCart.persist.hasHydrated(),
    () => false,
  );
}
