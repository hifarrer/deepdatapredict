"use client";

import { ExternalLink } from "lucide-react";
import type { EventSummary, Market } from "@/lib/kalshi/types";
import { categoryColor } from "@/lib/kalshi/categories";
import { daysUntil, formatPct, formatVolume, kalshiEventUrl } from "@/lib/utils";
import { PredictionModal } from "@/components/PredictionModal";

function multiplier(prob: number | null): string {
  if (!prob || prob <= 0) return "—";
  const m = 100 / prob;
  return `${m.toFixed(m >= 10 ? 1 : 2)}x`;
}

function OutcomeRow({ market }: { market: Market }) {
  const prob = market.lastProbability;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
        {market.title}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums text-slate-400">{multiplier(prob)}</span>
        <span className="inline-flex h-7 min-w-[3rem] items-center justify-center rounded-full border border-slate-200 px-2 text-sm font-semibold text-slate-900">
          {formatPct(prob)}
        </span>
      </div>
    </div>
  );
}

export function EventCard({
  event,
  readOnly = false,
}: {
  event: EventSummary;
  readOnly?: boolean;
}) {
  const color = categoryColor(event.category);
  const topMarkets = [...event.markets]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 3);
  const d = daysUntil(event.closeTime);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color }}
        >
          {event.category}
        </span>
        {event.category === "Sports" && event.league && event.league !== "Other" && (
          <span className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">
            · {event.league}
          </span>
        )}
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

      <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
        {topMarkets.map((m) => (
          <OutcomeRow key={m.ticker} market={m} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="text-xs text-slate-400">
          {formatVolume(event.totalVolume)} vol · {event.markets.length}{" "}
          {event.markets.length === 1 ? "market" : "markets"}
          {d != null && d >= 0 && <> · closes in {d}d</>}
        </div>
        {readOnly ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
            Closed
          </span>
        ) : (
          <PredictionModal event={event} />
        )}
      </div>
    </div>
  );
}
