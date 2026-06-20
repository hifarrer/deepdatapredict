import { prisma } from "@/lib/db";

const SLUG_SUFFIX = "prediction";

/** Turn any text into a lowercase, hyphenated, URL-safe slug fragment. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * The canonical public slug for a prediction, derived from its event title:
 *   "Will Zelensky and Putin speak?" → "will-zelensky-and-putin-speak-prediction"
 */
export function predictionSlugBase(title: string): string {
  const base = slugify(title) || "event";
  return `${base}-${SLUG_SUFFIX}`;
}

/**
 * A slug guaranteed unique across predictions. The first prediction for an event
 * gets the clean base slug; later collisions get a short id-derived suffix.
 */
export async function uniquePredictionSlug(
  title: string,
  id: string
): Promise<string> {
  const base = predictionSlugBase(title);
  const clash = await prisma.prediction.findFirst({
    where: { slug: base, NOT: { id } },
    select: { id: true },
  });
  return clash ? `${base}-${id.slice(-6)}` : base;
}
