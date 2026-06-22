/**
 * Extract a Kalshi *event* ticker from user input — either a full kalshi.com URL
 * or a bare ticker pasted directly.
 *
 * Kalshi web routes look like:
 *   https://kalshi.com/markets/{series}/{slug}/{eventTicker}?op_market_ticker={marketTicker}
 * e.g.
 *   .../kxwcgame/world-cup-game/kxwcgame-26jun22argaut?op_market_ticker=KXWCGAME-26JUN22ARGAUT-ARG
 * → event ticker = "KXWCGAME-26JUN22ARGAUT".
 *
 * The unit of work in this app is the (uppercase) event ticker, so we resolve to
 * that. We deliberately do NOT derive it from `op_market_ticker`, since event
 * tickers themselves contain "-" and the outcome suffix can't be split reliably.
 */
export function parseKalshiEventTicker(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Bare ticker pasted directly (no path), e.g. "KXWCGAME-26JUN22ARGAUT".
  if (!raw.includes("/") && /^[A-Za-z0-9-]+$/.test(raw)) {
    return raw.toUpperCase();
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  // Some links carry an explicit event_ticker query param — prefer it.
  const fromQuery =
    url.searchParams.get("event_ticker") ?? url.searchParams.get("eventTicker");
  if (fromQuery && /^[A-Za-z0-9-]+$/.test(fromQuery)) {
    return fromQuery.toUpperCase();
  }

  // Otherwise the last non-empty path segment is the event ticker.
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && /^[A-Za-z0-9-]+$/.test(last)) {
    return last.toUpperCase();
  }

  return null;
}
