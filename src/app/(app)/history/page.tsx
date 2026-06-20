import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasDatabase } from "@/lib/env";
import { HistoryClient, type PredictionListItem } from "@/components/HistoryClient";
import type { PredictionResult } from "@/lib/ai/schema";
import { uniquePredictionSlug } from "@/lib/slug";

export const metadata = { title: "History · DeepDataPredict" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        Please sign in to view your history.
      </div>
    );
  }

  if (!hasDatabase()) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        The database isn&apos;t configured yet. Set <code>DATABASE_URL</code> in{" "}
        <code>.env</code> and run migrations to enable saved history.
      </div>
    );
  }

  const rows = await prisma.prediction.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Backfill slugs for completed predictions created before slugs existed, so
  // their history rows can link to the public page.
  await Promise.all(
    rows
      .filter((r) => r.status === "COMPLETE" && !r.slug)
      .map(async (r) => {
        const slug = await uniquePredictionSlug(r.eventTitle, r.id);
        r.slug = slug;
        await prisma.prediction
          .update({ where: { id: r.id }, data: { slug } })
          .catch(() => {});
      })
  );

  const predictions: PredictionListItem[] = rows.map((r) => ({
    id: r.id,
    eventTitle: r.eventTitle,
    category: r.category,
    status: r.status,
    slug: r.slug,
    createdAt: r.createdAt.toISOString(),
    result: (r.result as PredictionResult | null) ?? null,
    error: r.error,
  }));

  return <HistoryClient predictions={predictions} />;
}
