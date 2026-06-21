import { prisma } from "@/lib/db";

export interface SiteSettings {
  /** Overall ceiling on events returned for the "All" tab (safety bound). */
  maxLiveEvents: number;
  /** Per-category cap used for any category without its own limit. */
  defaultCategoryLimit: number;
  /** Explicit per-category caps, e.g. { Politics: 50, World: 20, Sports: 100 }. */
  categoryLimits: Record<string, number>;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  maxLiveEvents: 300,
  defaultCategoryLimit: 20,
  categoryLimits: {},
};

function posInt(v: unknown, fallback: number): number {
  return typeof v === "number" && v > 0 ? Math.floor(v) : fallback;
}

/** Coerce a stored JSON value into a clean { category: positiveInt } map. */
function parseCategoryLimits(raw: unknown): Record<string, number> {
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
    categoryLimits: parseCategoryLimits(map.get("categoryLimits")),
  };
}

/** Per-category cap for a category, falling back to the global default. */
export function limitForCategory(settings: SiteSettings, category: string): number {
  return settings.categoryLimits[category] ?? settings.defaultCategoryLimit;
}

/** Persist a single setting value (admin only — guard at the call site). */
export async function setSiteSetting(key: string, value: unknown): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never },
  });
}
