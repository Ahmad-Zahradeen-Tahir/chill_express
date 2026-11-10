import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomCode } from "@/lib/ids";

export const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

/** Saves an uploaded product photo to local disk (works on any host). Returns the public URL. */
export async function saveProductImage(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 4 MB or smaller");
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf); // trust the bytes, not the browser-supplied type
  if (!type) throw new Error("Upload a JPG, PNG or WebP image");
  await mkdir(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, "products"), { recursive: true });
  const name = `${Date.now().toString(36)}-${randomCode(8).toLowerCase()}.${TYPES[type]}`;
  await writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, "products", name), buf);
  return `/api/uploads/products/${name}`;
}
