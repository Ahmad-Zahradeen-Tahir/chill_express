/** All money is stored and computed as integer kobo (₦1 = 100 kobo). */
export const KOBO_PER_NAIRA = 100;

export function naira(n: number): number {
  return Math.round(n * KOBO_PER_NAIRA);
}

const fmt = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₦3,000 — whole naira when possible, otherwise two decimals. */
export function formatNaira(kobo: number): string {
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(kobo);
  const body = abs % KOBO_PER_NAIRA === 0 ? fmt.format(abs / KOBO_PER_NAIRA) : fmt2.format(abs / KOBO_PER_NAIRA);
  return `${sign}₦${body}`;
}
