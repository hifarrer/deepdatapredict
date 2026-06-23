"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { EventSummary, Market } from "@/lib/kalshi/types";
import { categoryColor } from "@/lib/kalshi/categories";
import { flagUrl, splitMatchup } from "@/lib/kalshi/flags";
import { cn, daysUntil, formatPct, formatVolume, kalshiEventUrl } from "@/lib/utils";
import { PredictionModal } from "@/components/PredictionModal";

function multiplier(prob: number | null): string {
  if (!prob || prob <= 0) return "—";
  const m = 100 / prob;
  return `${m.toFixed(m >= 10 ? 1 : 2)}x`;
}

/**
 * Small flag for a national team, or null when the name isn't a known country.
 * Retina-served via flagcdn's wider PNG; alt is empty since the country name sits
 * right beside it.
 */
function CountryFlag({ country, className }: { country: string; className?: string }) {
  const src = flagUrl(country, 40);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny external flag CDN asset
    <img
      src={src}
      srcSet={`${src} 1x, ${flagUrl(country, 80)} 2x`}
      alt=""
      loading="lazy"
      className={cn(
        "h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover shadow-sm ring-1 ring-slate-900/10",
        className
      )}
    />
  );
}

function OutcomeRow({ market, showFlag = false }: { market: Market; showFlag?: boolean }) {
  const prob = market.lastProbability;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-700">
        {showFlag && <CountryFlag country={market.title} />}
        <span className="truncate">{market.title}</span>
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
  authenticated = true,
}: {
  event: EventSummary;
  readOnly?: boolean;
  /** Passed to the prediction trigger; anonymous users are prompted to sign in. */
  authenticated?: boolean;
}) {
  const color = categoryColor(event.category);
  const isWorldCup = event.category === "Sports" && event.league === "World Cup";
  // Flag the two teams in a head-to-head World Cup matchup title ("France vs Iraq").
  const matchup = isWorldCup ? splitMatchup(event.title) : null;
  const [expanded, setExpanded] = useState(false);
  const sortedMarkets = [...event.markets].sort((a, b) => b.volume - a.volume);
  const COLLAPSED_COUNT = 3;
  const hasMore = sortedMarkets.length > COLLAPSED_COUNT;
  const visibleMarkets = expanded
    ? sortedMarkets
    : sortedMarkets.slice(0, COLLAPSED_COUNT);
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
        {matchup && (
          <span className="mr-1.5 inline-flex translate-y-0.5 items-center gap-1">
            <CountryFlag country={matchup[0]} />
            <CountryFlag country={matchup[1]} />
          </span>
        )}
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
        {visibleMarkets.map((m) => (
          <OutcomeRow key={m.ticker} market={m} showFlag={isWorldCup} />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 inline-flex items-center gap-1 self-start text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700"
        >
          {expanded
            ? "Show less"
            : `more (${sortedMarkets.length - COLLAPSED_COUNT})`}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      )}

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
          <PredictionModal event={event} authenticated={authenticated} />
        )}
      </div>
    </div>
  );
}
