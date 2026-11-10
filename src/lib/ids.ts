import { createHash, randomBytes, randomInt } from "node:crypto";

// Unambiguous alphabet (no 0/O, 1/I/L).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function randomCode(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** e.g. CE-GR-7K3Q9P */
export function orderReference(branchCode: string): string {
  return `CE-${branchCode}-${randomCode(6)}`;
}

/** Unique Paystack transaction reference. */
export function paymentReference(prefix = "CEP"): string {
  return `${prefix}_${Date.now().toString(36).toUpperCase()}_${randomCode(8)}`;
}

export function newTrackingToken(): string {
  return randomBytes(24).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
