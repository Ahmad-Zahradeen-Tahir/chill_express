/** Pure helpers for branch opening hours (Africa/Lagos, UTC+1, no DST). */

export type HoursRow = { dayOfWeek: number; opens: string | null; closes: string | null; closed: boolean };
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function lagosNow(now = new Date()): { day: number; minutes: number } {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000); // UTC+1
  return { day: lagos.getUTCDay(), minutes: lagos.getUTCHours() * 60 + lagos.getUTCMinutes() };
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isWithinHours(hours: HoursRow[], now = new Date()): boolean {
  const { day, minutes } = lagosNow(now);
  const today = hours.find((h) => h.dayOfWeek === day);
  if (!today || today.closed || !today.opens || !today.closes) return false;
  const o = toMin(today.opens);
  const c = toMin(today.closes);
  if (c > o) return minutes >= o && minutes < c;
  // Closes after midnight (e.g. 10:00 - 01:00)
  return minutes >= o || minutes < c;
}

export type BranchOrderingState = {
  isOpen: boolean;
  acceptingOrders: boolean;
  enforceHours: boolean;
  closedMessage: string | null;
};

export function orderingBlockReason(b: BranchOrderingState, hours: HoursRow[], now = new Date()): string | null {
  if (!b.isOpen) return b.closedMessage || "This branch is temporarily closed.";
  if (!b.acceptingOrders) return b.closedMessage || "This branch is not accepting online orders right now.";
  if (b.enforceHours && !isWithinHours(hours, now)) return "This branch is currently outside its opening hours.";
  return null;
}
