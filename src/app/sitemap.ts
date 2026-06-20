import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { hasDatabase, SITE_URL } from "@/lib/env";

// Recompute on every request so newly completed prediction pages appear in the
// sitemap immediately, without a rebuild.
export const dynamic = "force-dynamic";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: SITE_URL, changeFrequency: "daily", priority: 1 },
  { url: `${SITE_URL}/how-it-works`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/plans`, changeFrequency: "monthly", priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!hasDatabase()) return STATIC_ROUTES;

  // Every completed prediction has a public, indexable page at /{slug}.
  const predictions = await prisma.prediction.findMany({
    where: { status: "COMPLETE", slug: { not: null } },
    select: { slug: true, completedAt: true, createdAt: true },
    orderBy: { completedAt: "desc" },
    take: 5000,
  });

  const predictionRoutes: MetadataRoute.Sitemap = predictions.map((p) => ({
    url: `${SITE_URL}/${p.slug}`,
    lastModified: p.completedAt ?? p.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...STATIC_ROUTES, ...predictionRoutes];
}
