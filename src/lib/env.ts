import { z } from "zod";

/**
 * Environment configuration. Secrets are optional at import time so that
 * `next build` works without them; accessors below throw a friendly error
 * only when a missing value is actually needed at runtime.
 */
const schema = z.object({
  DATABASE_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().optional(),
  KALSHI_API_BASE: z
    .string()
    .default("https://api.elections.kalshi.com/trade-api/v2"),
  PREDICTION_MODEL: z.string().default("claude-opus-4-8"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  AUTH_SECRET: process.env.AUTH_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  KALSHI_API_BASE: process.env.KALSHI_API_BASE,
  PREDICTION_MODEL: process.env.PREDICTION_MODEL,
  NODE_ENV: process.env.NODE_ENV,
});

export const env = parsed;

/** Stable, public config (always safe to read). */
export const KALSHI_API_BASE = parsed.KALSHI_API_BASE.replace(/\/+$/, "");
export const PREDICTION_MODEL = parsed.PREDICTION_MODEL;
export const IS_PROD = parsed.NODE_ENV === "production";

/** Public site origin used for canonical URLs, sitemap, robots, OG tags. */
export const SITE_URL = (
  parsed.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

/** Dev fallback so auth works locally even if AUTH_SECRET is unset. */
export function getAuthSecret(): string {
  if (parsed.AUTH_SECRET) return parsed.AUTH_SECRET;
  if (IS_PROD) {
    throw new Error("AUTH_SECRET is required in production.");
  }
  console.warn(
    "[env] AUTH_SECRET not set — using an insecure dev fallback. Set it in .env."
  );
  return "kalshipredict-dev-insecure-secret-change-me";
}

export function getAnthropicKey(): string {
  if (!parsed.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env to run predictions."
    );
  }
  return parsed.ANTHROPIC_API_KEY;
}

export function hasDatabase(): boolean {
  return Boolean(parsed.DATABASE_URL && !parsed.DATABASE_URL.includes("USER:PASSWORD"));
}

/**
 * Verify a cron request's bearer token against CRON_SECRET. Returns false when
 * the secret is unset in production (fail closed). In dev, an unset secret
 * allows the request so the endpoint can be exercised locally.
 */
export function isAuthorizedCron(authHeader: string | null): boolean {
  const secret = parsed.CRON_SECRET;
  if (!secret) return !IS_PROD;
  return authHeader === `Bearer ${secret}`;
}
