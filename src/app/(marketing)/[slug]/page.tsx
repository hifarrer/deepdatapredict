import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasDatabase } from "@/lib/env";
import type { KalshiSnapshot, PredictionResult } from "@/lib/ai/schema";
import { PredictionResultView } from "@/components/PredictionResultView";
import { Button } from "@/components/ui/button";
import { formatDate, kalshiEventUrl } from "@/lib/utils";

// Public, SEO-facing page — revalidate occasionally rather than per request.
export const revalidate = 3600;

/**
 * Load a completed, publicly shareable prediction by its slug. Memoized per
 * request so generateMetadata and the page itself share a single query.
 */
const getPrediction = cache(async (slug: string) => {
  if (!hasDatabase()) return null;
  const prediction = await prisma.prediction.findUnique({ where: { slug } });
  if (!prediction || prediction.status !== "COMPLETE" || !prediction.result) {
    return null;
  }
  return prediction;
});

function clip(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const prediction = await getPrediction(slug);
  if (!prediction) {
    return { title: "Prediction not found · DeepDataPredict" };
  }

  const result = prediction.result as unknown as PredictionResult;
  const title = `${prediction.eventTitle} — AI Prediction & Probability`;
  const description = clip(result.headline || result.summary);

  return {
    title,
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/${slug}`,
      siteName: "DeepDataPredict",
      publishedTime: prediction.completedAt?.toISOString(),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PredictionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const prediction = await getPrediction(slug);
  if (!prediction) notFound();

  const result = prediction.result as unknown as PredictionResult;
  const snapshot = (prediction.kalshiSnapshot as unknown as KalshiSnapshot) ?? null;
  const kalshiUrl = kalshiEventUrl(
    prediction.eventTicker,
    snapshot?.event?.seriesTicker
  );

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <nav className="mb-4 text-sm text-slate-400">
        <Link href="/" className="hover:text-slate-600">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-500">Predictions</span>
      </nav>

      <header className="space-y-3">
        {prediction.category && (
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            {prediction.category}
          </span>
        )}
        <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
          {prediction.eventTitle}
        </h1>
        <p className="text-sm text-slate-500">
          AI prediction &amp; probability analysis
          {prediction.completedAt && (
            <> · {formatDate(prediction.completedAt.toISOString())}</>
          )}
          {prediction.modelUsed && <> · {prediction.modelUsed}</>}
        </p>
        <a
          href={kalshiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline"
        >
          View this event on Kalshi
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </header>

      <div className="mt-8">
        <PredictionResultView result={result} snapshot={snapshot} />
      </div>

      <aside className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-slate-900">
          Want an AI prediction for another event?
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Generate deep, web-researched probability estimates for any live Kalshi
          market.
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">
            <Sparkles className="h-4 w-4" />
            Explore live events
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </aside>
    </article>
  );
}
