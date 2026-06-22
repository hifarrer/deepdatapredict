import { prisma } from "@/lib/db";

export interface SiteSettings {
  /** Overall ceiling on events returned for the "All" tab (safety bound). */
  maxLiveEvents: number;
  /** Per-category cap used for any category without its own limit. */
  defaultCategoryLimit: number;
  /** Explicit per-category caps, e.g. { Politics: 50, World: 20, Sports: 100 }. */
  categoryLimits: Record<string, number>;
  /** Per-sport cap (within Sports) used for any sport without its own limit. */
  defaultSportLimit: number;
  /** Explicit per-sport caps, e.g. { Basketball: 30, Soccer: 15 }. */
  sportLimits: Record<string, number>;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  // Overall ceiling sized to fit the balanced per-category caps (Sports alone
  // can be several hundred), so the cron isn't cut short before Sports fills.
  maxLiveEvents: 1500,
  defaultCategoryLimit: 20,
  categoryLimits: {},
  defaultSportLimit: 25,
  // Soccer runs high so the live World Cup / major leagues come through in force.
  // (Overridden by any per-sport limits saved in the admin settings.)
  sportLimits: { Soccer: 200 },
};

function posInt(v: unknown, fallback: number): number {
  return typeof v === "number" && v > 0 ? Math.floor(v) : fallback;
}

/** Coerce a stored JSON value into a clean { name: positiveInt } map. */
function parseLimits(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n) && n > 0) out[key] = Math.floor(n);
  }
  return out;
}

/** Read all site settings, falling back to defaults for any missing keys. */
export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await prisma.siteSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    maxLiveEvents: posInt(map.get("maxLiveEvents"), DEFAULT_SETTINGS.maxLiveEvents),
    defaultCategoryLimit: posInt(
      map.get("defaultCategoryLimit"),
      DEFAULT_SETTINGS.defaultCategoryLimit
    ),
    categoryLimits: parseLimits(map.get("categoryLimits")),
    defaultSportLimit: posInt(
      map.get("defaultSportLimit"),
      DEFAULT_SETTINGS.defaultSportLimit
    ),
    sportLimits: parseLimits(map.get("sportLimits")),
  };
}

/** Per-category cap for a category, falling back to the global default. */
export function limitForCategory(settings: SiteSettings, category: string): number {
  return settings.categoryLimits[category] ?? settings.defaultCategoryLimit;
}

/** Per-sport cap for a sport, falling back to the global sport default. */
export function limitForSport(settings: SiteSettings, sport: string): number {
  return settings.sportLimits[sport] ?? settings.defaultSportLimit;
}

/** Persist a single setting value (admin only — guard at the call site). */
export async function setSiteSetting(key: string, value: unknown): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never },
  });
}

const MANUAL_EVENTS_KEY = "manualEventTickers";

/**
 * Event tickers users imported by URL. These persist independently of the live
 * snapshot (which the cron rebuilds from scratch) so the cron can re-merge them
 * into every refresh — keeping manually-added events in the curated list.
 */
export async function getManualEventTickers(): Promise<string[]> {
  const row = await prisma.siteSetting.findUnique({
    where: { key: MANUAL_EVENTS_KEY },
  });
  const value = row?.value;
  if (!Array.isArray(value)) return [];
  return value.filter((t): t is string => typeof t === "string");
}

/** Add an imported event ticker to the persistent manual list (dedup). */
export async function addManualEventTicker(ticker: string): Promise<void> {
  const current = await getManualEventTickers();
  if (current.includes(ticker)) return;
  await setSiteSetting(MANUAL_EVENTS_KEY, [ticker, ...current]);
}
