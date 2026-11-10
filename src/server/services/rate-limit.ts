import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

/**
 * Fixed-window rate limiter stored in Postgres (works across processes; no Redis needed).
 * Returns true if the request is allowed.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const res = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit (key, count, window_start) VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit.window_start < now() - make_interval(secs => ${windowSeconds}) THEN 1 ELSE rate_limit.count + 1 END,
      window_start = CASE WHEN rate_limit.window_start < now() - make_interval(secs => ${windowSeconds}) THEN now() ELSE rate_limit.window_start END
    RETURNING count
  `);
  const count = Number(res.rows[0]?.count ?? 0);
  return count <= max;
}

export async function clientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
