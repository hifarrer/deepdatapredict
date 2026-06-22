"use client";

import { AlertTriangle, ExternalLink, TrendingDown, TrendingUp } from "lucide-react";
import type { KalshiSnapshot, PredictionResult } from "@/lib/ai/schema";
import { Badge } from "@/components/ui/badge";
import { ProbabilityGauge } from "@/components/charts/ProbabilityGauge";
import { PriceHistoryChart } from "@/components/charts/PriceHistoryChart";
import { FactorBarChart } from "@/components/charts/FactorBarChart";
import { HeadToHead } from "@/components/charts/HeadToHead";
import { formatPct } from "@/lib/utils";

function confidenceVariant(label: string) {
  if (label === "High") return "emerald" as const;
  if (label === "Medium") return "amber" as const;
  return "red" as const;
}

export function PredictionResultView({
  result,
  snapshot,
}: {
  result: PredictionResult;
  snapshot?: KalshiSnapshot | null;
}) {
  const pick = result.topPick;
  const pickMarket = result.marketsAnalyzed.find((m) => m.ticker === pick.ticker);
  const implied = pickMarket?.kalshiImpliedProbability ?? null;
  const candles = snapshot?.candles?.[pick.ticker] ?? [];

  // Build the outcome table rows. When a snapshot is available, show *every*
  // outcome with its Kalshi price and overlay the AI numbers for the ones that
  // were deep-analyzed. Older predictions without a snapshot fall back to just
  // the analyzed markets.
  const analyzedByTicker = new Map(result.marketsAnalyzed.map((m) => [m.ticker, m]));
  const outcomeRows = snapshot?.event?.markets
    ? [...snapshot.event.markets]
        .sort((a, b) => (b.lastProbability ?? -1) - (a.lastProbability ?? -1))
        .map((m) => {
          const ai = analyzedByTicker.get(m.ticker);
          return {
            ticker: m.ticker,
            title: m.title,
            kalshiImpliedProbability: m.lastProbability,
            predictedProbability: ai?.predictedProbability ?? null,
            edge: ai?.edge ?? null,
          };
        })
    : result.marketsAnalyzed.map((m) => ({
        ticker: m.ticker,
        title: m.title,
        kalshiImpliedProbability: m.kalshiImpliedProbability,
        predictedProbability: m.predictedProbability as number | null,
        edge: m.edge,
      }));
  const hasUnanalyzed = outcomeRows.some((r) => r.predictedProbability == null);

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          This is an AI estimation and does not guarantee results. It is for
          informational purposes only — not financial advice.
        </span>
      </div>

      {/* Headline + gauge */}
      <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:items-center">
        <ProbabilityGauge
          probability={pick.probability}
          impliedProbability={implied}
          caption={`${pick.side} likely`}
        />
        <div className="space-y-3">
          <p className="text-lg font-semibold leading-snug text-slate-900">
            {result.headline}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">Pick: {pick.title}</Badge>
            <Badge variant={pick.side === "YES" ? "emerald" : "red"}>{pick.side}</Badge>
            <Badge variant={confidenceVariant(pick.confidenceLabel)}>
              {pick.confidenceLabel} confidence · {formatPct(pick.confidence)}
            </Badge>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Confidence</span>
              <span>{formatPct(pick.confidence)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${Math.min(100, Math.max(0, pick.confidence))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Analysis</h4>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
          {result.summary}
        </p>
      </div>

      {/* Price history */}
      {candles.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">
            Kalshi price history · {pick.title}
          </h4>
          <PriceHistoryChart candles={candles} />
        </div>
      )}

      {/* Key factors */}
      {result.keyPoints.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">Key factors</h4>
          <FactorBarChart keyPoints={result.keyPoints} />
        </div>
      )}

      {/* Head to head */}
      {result.comparison && result.comparison.entities.length > 0 && (
        <HeadToHead title={result.comparison.title} entities={result.comparison.entities} />
      )}

      {/* Markets analyzed */}
      {outcomeRows.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">Outcome probabilities</h4>
          {hasUnanalyzed && (
            <p className="text-xs text-slate-500">
              The AI deep-analyzed the top outcomes by Kalshi price; the rest show
              the market price only.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-3 py-2 font-medium">Outcome</th>
                  <th className="px-3 py-2 font-medium">AI</th>
                  <th className="px-3 py-2 font-medium">Kalshi</th>
                  <th className="px-3 py-2 font-medium">Edge</th>
                </tr>
              </thead>
              <tbody>
                {outcomeRows.map((m) => (
                  <tr key={m.ticker} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{m.title}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">
                      {m.predictedProbability == null ? (
                        <span className="font-normal text-slate-400">—</span>
                      ) : (
                        formatPct(m.predictedProbability)
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatPct(m.kalshiImpliedProbability)}
                    </td>
                    <td className="px-3 py-2">
                      {m.edge == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            m.edge >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {m.edge >= 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {m.edge >= 0 ? "+" : ""}
                          {Math.round(m.edge)} pts
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Risks */}
      {result.risks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">Risks &amp; uncertainties</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            {result.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sources */}
      {result.sources.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">Sources</h4>
          <ul className="space-y-1 text-sm">
            {result.sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
                >
                  {s.title || s.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
