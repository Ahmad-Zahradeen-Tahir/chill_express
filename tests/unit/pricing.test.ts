import { describe, expect, it } from "vitest";
import { priceCart, PricingError, type CatalogProduct } from "@/server/services/pricing-core";

const shawarma: CatalogProduct = {
  id: "shawarma", name: "Shawarma", categoryName: "Shawarma", basePriceKobo: 300000, active: true, categoryActive: true, availableAtBranch: true,
  groups: [
    { id: "g-protein", name: "Protein", required: true, minSelect: 1, maxSelect: 1, options: [
      { id: "beef", name: "Beef", priceDeltaKobo: 0, active: true }, { id: "chicken", name: "Chicken", priceDeltaKobo: 0, active: true } ] },
    { id: "g-size", name: "Size", required: true, minSelect: 1, maxSelect: 1, options: [
      { id: "regular", name: "Regular Size", priceDeltaKobo: 0, active: true },
      { id: "queen", name: "Queen Size", priceDeltaKobo: 150000, active: true },
      { id: "king", name: "King Size", priceDeltaKobo: 300000, active: true },
      { id: "special", name: "Chill Special", priceDeltaKobo: 550000, active: true } ] },
  ],
};
const fries = (id: string, base: number): CatalogProduct => ({
  id, name: id, categoryName: "Loaded Fries", basePriceKobo: base, active: true, categoryActive: true, availableAtBranch: true,
  groups: [{ id: `${id}-x`, name: "Extras", required: false, minSelect: 0, maxSelect: 1, options: [{ id: `${id}-cheese`, name: "With Cheese", priceDeltaKobo: 50000, active: true }] }],
});
const soda: CatalogProduct = { id: "soda", name: "Soda", categoryName: "Beverages", basePriceKobo: 150000, active: true, categoryActive: true, availableAtBranch: true, groups: [] };
const catalog = new Map([shawarma, fries("regular-box", 300000), fries("mega-box", 400000), fries("super", 600000), soda].map((p) => [p.id, p]));

describe("official menu pricing", () => {
  it.each([
    ["regular", 300000], ["queen", 450000], ["king", 600000], ["special", 850000],
  ])("shawarma %s = exact price", (size, kobo) => {
    const r = priceCart(catalog, [{ productId: "shawarma", optionIds: ["chicken", size], quantity: 1 }], 0);
    expect(r.totalKobo).toBe(kobo);
  });
  it.each([
    ["regular-box", 300000, 350000], ["mega-box", 400000, 450000], ["super", 600000, 650000],
  ])("loaded fries %s: standard and with cheese", (id, std, cheese) => {
    expect(priceCart(catalog, [{ productId: id, optionIds: [], quantity: 1 }], 0).totalKobo).toBe(std);
    expect(priceCart(catalog, [{ productId: id, optionIds: [`${id}-cheese`], quantity: 1 }], 0).totalKobo).toBe(cheese);
  });
  it("adds delivery fee and multiplies quantities", () => {
    const r = priceCart(catalog, [
      { productId: "shawarma", optionIds: ["beef", "king"], quantity: 2 },
      { productId: "soda", optionIds: [], quantity: 3 },
    ], 200000);
    expect(r.subtotalKobo).toBe(2 * 600000 + 3 * 150000);
    expect(r.totalKobo).toBe(r.subtotalKobo + 200000);
    expect(r.lines[0].options.map((o) => o.optionName)).toEqual(["Beef", "King Size"]);
  });
});

describe("validation", () => {
  const bad = (lines: Parameters<typeof priceCart>[1], cat = catalog) => () => priceCart(cat, lines, 0);
  it("requires protein and size", () => {
    expect(bad([{ productId: "shawarma", optionIds: ["king"], quantity: 1 }])).toThrow(PricingError);
    expect(bad([{ productId: "shawarma", optionIds: ["beef"], quantity: 1 }])).toThrow(/Size/);
  });
  it("rejects two sizes, foreign options and duplicates", () => {
    expect(bad([{ productId: "shawarma", optionIds: ["beef", "king", "queen"], quantity: 1 }])).toThrow(/Too many/);
    expect(bad([{ productId: "soda", optionIds: ["regular-box-cheese"], quantity: 1 }])).toThrow(/Invalid option/);
    expect(bad([{ productId: "regular-box", optionIds: ["regular-box-cheese", "regular-box-cheese"], quantity: 1 }])).toThrow(/Duplicate/);
  });
  it("rejects unavailable, inactive and unknown products", () => {
    const c2 = new Map(catalog);
    c2.set("soda", { ...soda, availableAtBranch: false });
    expect(bad([{ productId: "soda", optionIds: [], quantity: 1 }], c2)).toThrow(/unavailable/);
    c2.set("soda", { ...soda, active: false });
    expect(bad([{ productId: "soda", optionIds: [], quantity: 1 }], c2)).toThrow(/no longer/);
    expect(bad([{ productId: "nope", optionIds: [], quantity: 1 }])).toThrow(PricingError);
  });
  it("rejects bad quantities and empty carts", () => {
    expect(bad([{ productId: "soda", optionIds: [], quantity: 0 }])).toThrow();
    expect(bad([{ productId: "soda", optionIds: [], quantity: 51 }])).toThrow();
    expect(bad([{ productId: "soda", optionIds: [], quantity: 1.5 }])).toThrow();
    expect(bad([])).toThrow(/empty/);
  });
  it("ignores any client-side price: only ids and quantities are inputs", () => {
    const tampered = [{ productId: "soda", optionIds: [], quantity: 1, priceKobo: 1 } as never];
    expect(priceCart(catalog, tampered, 0).totalKobo).toBe(150000);
  });
});
