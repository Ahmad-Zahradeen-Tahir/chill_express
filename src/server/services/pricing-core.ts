/**
 * Pure pricing logic (no DB) so it can be unit tested.
 * The client only ever sends product ids, option ids and quantities. Every price comes from here.
 */

export type CatalogOption = { id: string; name: string; priceDeltaKobo: number; active: boolean };
export type CatalogGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: CatalogOption[];
};
export type CatalogProduct = {
  id: string;
  name: string;
  categoryName: string;
  basePriceKobo: number;
  active: boolean;
  categoryActive: boolean;
  availableAtBranch: boolean;
  groups: CatalogGroup[];
};

export type CartLineInput = { productId: string; optionIds: string[]; quantity: number };

export type PricedLine = {
  productId: string;
  productName: string;
  categoryName: string;
  unitPriceKobo: number;
  quantity: number;
  lineTotalKobo: number;
  options: { optionId: string; groupName: string; optionName: string; priceDeltaKobo: number }[];
};

export class PricingError extends Error {
  constructor(
    message: string,
    public productId?: string,
  ) {
    super(message);
  }
}

export const MAX_QTY_PER_LINE = 50;
export const MAX_LINES = 40;

export function priceLine(p: CatalogProduct | undefined, line: CartLineInput): PricedLine {
  if (!p) throw new PricingError("An item in your cart no longer exists.", line.productId);
  if (!p.active || !p.categoryActive) throw new PricingError(`${p.name} is no longer on the menu.`, p.id);
  if (!p.availableAtBranch) throw new PricingError(`${p.name} is currently unavailable at this branch.`, p.id);
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QTY_PER_LINE) {
    throw new PricingError(`Invalid quantity for ${p.name}.`, p.id);
  }
  const unique = new Set(line.optionIds);
  if (unique.size !== line.optionIds.length) throw new PricingError(`Duplicate options for ${p.name}.`, p.id);

  const chosen: PricedLine["options"] = [];
  let consumed = 0;
  for (const g of p.groups) {
    const picked = g.options.filter((o) => unique.has(o.id));
    consumed += picked.length;
    const min = Math.max(g.minSelect, g.required ? 1 : 0);
    if (picked.length < min) throw new PricingError(`Please choose ${g.name} for ${p.name}.`, p.id);
    if (picked.length > g.maxSelect) throw new PricingError(`Too many ${g.name} choices for ${p.name}.`, p.id);
    for (const o of picked) {
      if (!o.active) throw new PricingError(`${o.name} is no longer available for ${p.name}.`, p.id);
      chosen.push({ optionId: o.id, groupName: g.name, optionName: o.name, priceDeltaKobo: o.priceDeltaKobo });
    }
  }
  if (consumed !== unique.size) throw new PricingError(`Invalid option selected for ${p.name}.`, p.id);

  const unit = p.basePriceKobo + chosen.reduce((s, o) => s + o.priceDeltaKobo, 0);
  if (unit < 0) throw new PricingError(`Invalid price for ${p.name}.`, p.id);
  return {
    productId: p.id,
    productName: p.name,
    categoryName: p.categoryName,
    unitPriceKobo: unit,
    quantity: line.quantity,
    lineTotalKobo: unit * line.quantity,
    options: chosen,
  };
}

export function priceCart(
  catalog: Map<string, CatalogProduct>,
  lines: CartLineInput[],
  deliveryFeeKobo: number,
): { lines: PricedLine[]; subtotalKobo: number; deliveryFeeKobo: number; totalKobo: number } {
  if (lines.length === 0) throw new PricingError("Your cart is empty.");
  if (lines.length > MAX_LINES) throw new PricingError("Too many items in one order.");
  const priced = lines.map((l) => priceLine(catalog.get(l.productId), l));
  const subtotal = priced.reduce((s, l) => s + l.lineTotalKobo, 0);
  return { lines: priced, subtotalKobo: subtotal, deliveryFeeKobo, totalKobo: subtotal + deliveryFeeKobo };
}

export function describeOptions(options: { optionName: string }[]): string {
  return options.map((o) => o.optionName).join(" · ");
}
