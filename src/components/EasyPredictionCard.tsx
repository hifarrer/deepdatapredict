"use client";

import { ExternalLink, TrendingDown, TrendingUp } from "lucide-react";
import type { EasyPick } from "@/lib/ai/easy";
import { categoryColor } from "@/lib/kalshi/categories";
import { Badge } from "@/components/ui/badge";
import { PredictionModal } from "@/components/PredictionModal";
import { daysUntil, formatPct, formatVolume, kalshiEventUrl } from "@/lib/utils";

function predictabilityVariant(score: number) {
  if (score >= 70) return "emerald" as const;
  if (score >= 40) return "amber" as const;
  return "red" as const;
}

/**
 * A curated "easy prediction" card: the event, why it's forecastable, and an
 * AI-vs-Kalshi outcome table (the comparison column), plus the same Generate
 * prediction button as the dashboard.
 */
export function EasyPredictionCard({
  pick,
  authenticated = true,
}: {
  pick: EasyPick;
  authenticated?: boolean;
}) {
  const { event } = pick;
  const color = categoryColor(event.category);
  const d = daysUntil(event.closeTime);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span
            className="truncate text-xs font-semibold uppercase tracking-wide"
            style={{ color }}
          >
            {event.category}
          </span>
        </div>
        <Badge
          variant={predictabilityVariant(pick.predictability)}
          title="How confidently the AI judged this event forecastable from public info"
        >
          {pick.predictability}% predictable
        </Badge>
      </div>

      <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold text-slate-900">
        {event.title}
        <a
          href={kalshiEventUrl(event.eventTicker, event.seriesTicker)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Open this event on Kalshi (new window)"
          aria-label="Open this event on Kalshi in a new window"
          className="ml-1.5 inline-flex translate-y-0.5 text-emerald-600 transition-colors hover:text-emerald-700"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </h3>

      {pick.reason && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
          {pick.reason}
        </p>
      )}

      {/* AI vs Kalshi comparison table */}
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
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
            {pick.outcomes.map((o) => (
              <tr key={o.ticker} className="border-t border-slate-100">
                <td className="max-w-[10rem] truncate px-3 py-2 text-slate-700" title={o.title}>
                  {o.title}
                </td>
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {o.aiProb == null ? (
                    <span className="font-normal text-slate-400">—</span>
                  ) : (
                    formatPct(o.aiProb)
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">{formatPct(o.kalshiProb)}</td>
                <td className="px-3 py-2">
                  {o.edge == null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        o.edge >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {o.edge >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {o.edge >= 0 ? "+" : ""}
                      {Math.round(o.edge)} pts
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="text-xs text-slate-400">
          {formatVolume(event.totalVolume)} vol · {event.markets.length}{" "}
          {event.markets.length === 1 ? "market" : "markets"}
          {d != null && d >= 0 && <> · closes in {d}d</>}
        </div>
        <PredictionModal event={event} authenticated={authenticated} />
      </div>
    </div>
  );
}
