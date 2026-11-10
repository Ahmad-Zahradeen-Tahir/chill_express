import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UPLOAD_DIR } from "@/server/services/uploads";

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const full = path.resolve(/*turbopackIgnore: true*/ UPLOAD_DIR, ...parts);
  // Path traversal guard.
  if (!full.startsWith(UPLOAD_DIR + path.sep)) return new NextResponse("Not found", { status: 404 });
  const type = MIME[path.extname(full).toLowerCase()];
  if (!type) return new NextResponse("Not found", { status: 404 });
  try {
    const buf = await readFile(full);
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
