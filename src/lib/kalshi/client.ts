import { KALSHI_API_BASE } from "@/lib/env";
import type {
  CandlePoint,
  EventSummary,
  Market,
  RawCandle,
  RawKalshiEvent,
  RawKalshiMarket,
} from "./types";

const DEFAULT_TIMEOUT = 20_000;

async function kalshiFetch<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  timeoutMs = DEFAULT_TIMEOUT
): Promise<T> {
  const url = new URL(`${KALSHI_API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Kalshi ${path} → ${res.status}: ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ---- price normalization helpers ----
// Kalshi returns numeric fields as strings ("0.1600", "107929.58"), so every
// numeric read must coerce.

function num(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isNaN(v) ? undefined : v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function clampProb(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Convert a Kalshi price (cents 0-100 or dollars 0-1) to probability 0-100. */
function toProbability(dollars: unknown, cents: unknown): number | null {
  const d = num(dollars);
  if (d !== undefined) return clampProb(d * 100);
  const c = num(cents);
  if (c !== undefined) {
    // Some payloads send dollars under the cents key (0-1); detect and scale.
    return clampProb(c <= 1 ? c * 100 : c);
  }
  return null;
}

function pickNumber(...vals: unknown[]): number {
  for (const v of vals) {
    const n = num(v);
    if (n !== undefined) return n;
  }
  return 0;
}

export function normalizeMarket(m: RawKalshiMarket): Market {
  const lastProbability = toProbability(m.last_price_dollars, m.last_price);
  const yesBid = toProbability(m.yes_bid_dollars, m.yes_bid);
  const yesAsk = toProbability(m.yes_ask_dollars, m.yes_ask);
  return {
    ticker: m.ticker,
    eventTicker: m.event_ticker ?? "",
    title: m.yes_sub_title || m.subtitle || m.title || m.ticker,
    yesSubTitle: m.yes_sub_title,
    noSubTitle: m.no_sub_title,
    status: m.status ?? "unknown",
    yesBid,
    yesAsk,
    lastProbability:
      lastProbability ??
      (yesBid != null && yesAsk != null ? (yesBid + yesAsk) / 2 : yesBid ?? yesAsk),
    volume: pickNumber(m.volume, m.volume_fp),
    volume24h: pickNumber(m.volume_24h, m.volume_24h_fp),
    openInterest: pickNumber(m.open_interest, m.open_interest_fp),
    openTime: m.open_time,
    closeTime: m.close_time,
    expirationTime: m.expiration_time ?? m.latest_expiration_time,
    rulesPrimary: m.rules_primary,
  };
}

const OPEN_STATUSES = new Set(["open", "active"]);

function soonestClose(markets: Market[]): string | undefined {
  const times = markets
    .map((m) => m.closeTime)
    .filter((t): t is string => Boolean(t))
    .sort();
  return times[0];
}

export function normalizeEvent(e: RawKalshiEvent): EventSummary {
  const markets = (e.markets ?? []).map(normalizeMarket);
  const isLive = markets.some((m) => OPEN_STATUSES.has(m.status.toLowerCase()));
  return {
    eventTicker: e.event_ticker,
    seriesTicker: e.series_ticker,
    title: e.title || e.event_ticker,
    subTitle: e.sub_title,
    category: (e.category && e.category.trim()) || "Other",
    mutuallyExclusive: Boolean(e.mutually_exclusive),
    markets,
    totalVolume: markets.reduce((s, m) => s + m.volume, 0),
    volume24h: markets.reduce((s, m) => s + m.volume24h, 0),
    closeTime: soonestClose(markets),
    isLive,
  };
}

// ---- public API ----

interface GetEventsResponse {
  events: RawKalshiEvent[];
  cursor?: string;
}

async function fetchEvents(
  status: string,
  limit: number,
  cursor?: string
): Promise<{ events: EventSummary[]; cursor?: string }> {
  const data = await kalshiFetch<GetEventsResponse>("/events", {
    status,
    limit,
    with_nested_markets: true,
    cursor,
  });
  const events = (data.events ?? [])
    .map(normalizeEvent)
    .filter((e) => e.markets.length > 0);
  // Kalshi returns an empty-string cursor when there are no more pages.
  return { events, cursor: data.cursor || undefined };
}

/**
 * Fetch open (live) events with nested markets. Returns normalized events that
 * have at least one tradeable market, sorted by trading volume (≈ "trending").
 */
export async function getLiveEvents(limit = 200): Promise<EventSummary[]> {
  const { events } = await fetchEvents("open", limit);
  const live = events.filter((e) => e.isLive);
  live.sort((a, b) => b.totalVolume - a.totalVolume);
  return live;
}

/**
 * Fetch *all* live events by walking Kalshi's cursor pagination (200/page).
 * Kalshi caps `limit` at 200 per request, so deep coverage of low-volume
 * categories requires paging. Used by the cron refresh endpoint.
 */
export async function getAllLiveEvents(maxPages = 10): Promise<EventSummary[]> {
  const all: EventSummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchEvents("open", 200, cursor);
    all.push(...res.events);
    cursor = res.cursor;
    if (!cursor) break;
  }
  const live = all.filter((e) => e.isLive);
  live.sort((a, b) => b.totalVolume - a.totalVolume);
  return live;
}

/** Fetch events by an arbitrary status (e.g. "settled", "closed") for History. */
export async function getEventsByStatus(
  status: string,
  limit = 60
): Promise<EventSummary[]> {
  const { events } = await fetchEvents(status, limit);
  events.sort((a, b) => b.totalVolume - a.totalVolume);
  return events;
}

interface GetEventResponse {
  event: RawKalshiEvent;
  markets?: RawKalshiMarket[];
}

export async function getEvent(eventTicker: string): Promise<EventSummary | null> {
  const data = await kalshiFetch<GetEventResponse>(
    `/events/${encodeURIComponent(eventTicker)}`,
    { with_nested_markets: true }
  );
  if (!data?.event) return null;
  // Some responses put markets alongside the event rather than nested.
  if ((!data.event.markets || data.event.markets.length === 0) && data.markets) {
    data.event.markets = data.markets;
  }
  return normalizeEvent(data.event);
}

interface GetCandlesResponse {
  candlesticks?: RawCandle[];
}

function candleClose(c: RawCandle): number | null {
  const scale = (n: number) => clampProb(n <= 1 ? n * 100 : n);
  const price = num(c.price?.close_dollars);
  if (price !== undefined) return scale(price);
  const bid = num(c.yes_bid?.close_dollars);
  const ask = num(c.yes_ask?.close_dollars);
  if (bid !== undefined && ask !== undefined) return scale((bid + ask) / 2);
  if (bid !== undefined) return scale(bid);
  const mean = num(c.price?.mean_dollars);
  if (mean !== undefined) return scale(mean);
  return null;
}

/**
 * Daily candlestick history for a market. period_interval: 1=min, 60=hour, 1440=day.
 */
export async function getCandles(
  seriesTicker: string,
  marketTicker: string,
  opts: { days?: number; periodInterval?: number } = {}
): Promise<CandlePoint[]> {
  const days = opts.days ?? 90;
  const periodInterval = opts.periodInterval ?? 1440;
  const endTs = Math.floor(Date.now() / 1000);
  const startTs = endTs - days * 24 * 60 * 60;
  try {
    const data = await kalshiFetch<GetCandlesResponse>(
      `/series/${encodeURIComponent(seriesTicker)}/markets/${encodeURIComponent(
        marketTicker
      )}/candlesticks`,
      { start_ts: startTs, end_ts: endTs, period_interval: periodInterval }
    );
    return (data.candlesticks ?? [])
      .map((c) => ({
        ts: (c.end_period_ts ?? 0) * 1000,
        close: candleClose(c),
        volume: pickNumber(c.volume_fp, c.volume),
      }))
      .filter((p) => p.ts > 0);
  } catch {
    // Candlesticks are best-effort; never block a prediction on history.
    return [];
  }
}
