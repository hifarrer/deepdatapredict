// ---- Raw Kalshi API shapes (permissive — the API mixes cents/dollars/_fp) ----

export interface RawKalshiMarket {
  ticker: string;
  event_ticker?: string;
  market_type?: string;
  title?: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status?: string;
  // prices may arrive as cents (0-100) or dollars (0-1)
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  yes_bid_dollars?: number;
  yes_ask_dollars?: number;
  no_bid_dollars?: number;
  no_ask_dollars?: number;
  last_price_dollars?: number;
  volume?: number;
  volume_24h?: number;
  volume_fp?: number;
  volume_24h_fp?: number;
  open_interest?: number;
  open_interest_fp?: number;
  open_time?: string;
  close_time?: string;
  expiration_time?: string;
  latest_expiration_time?: string;
  rules_primary?: string;
  rules_secondary?: string;
  result?: string;
  [key: string]: unknown;
}

export interface RawKalshiEvent {
  event_ticker: string;
  series_ticker?: string;
  title?: string;
  sub_title?: string;
  category?: string;
  mutually_exclusive?: boolean;
  strike_date?: string;
  strike_period?: string;
  markets?: RawKalshiMarket[];
  last_updated_ts?: number;
  [key: string]: unknown;
}

type Num = number | string;

export interface RawCandle {
  end_period_ts?: number;
  price?: {
    open_dollars?: Num;
    high_dollars?: Num;
    low_dollars?: Num;
    close_dollars?: Num;
    mean_dollars?: Num;
    previous_dollars?: Num;
  };
  yes_bid?: { open_dollars?: Num; high_dollars?: Num; low_dollars?: Num; close_dollars?: Num };
  yes_ask?: { open_dollars?: Num; high_dollars?: Num; low_dollars?: Num; close_dollars?: Num };
  volume_fp?: Num;
  volume?: Num;
  open_interest_fp?: Num;
  [key: string]: unknown;
}

// ---- Normalized shapes used across the app ----

export interface Market {
  ticker: string;
  eventTicker: string;
  title: string;
  yesSubTitle?: string;
  noSubTitle?: string;
  status: string;
  /** Probabilities expressed 0-100. */
  yesBid: number | null;
  yesAsk: number | null;
  lastProbability: number | null; // implied YES probability from last trade
  volume: number;
  volume24h: number;
  openInterest: number;
  openTime?: string;
  closeTime?: string;
  expirationTime?: string;
  rulesPrimary?: string;
}

export interface EventSummary {
  eventTicker: string;
  seriesTicker?: string;
  title: string;
  subTitle?: string;
  category: string;
  /** For Sports events, the specific sport (Football, Basketball, …). */
  subCategory?: string;
  /**
   * For Sports events, the specific league/competition (Premier League, MLS,
   * World Cup, …), derived from the series ticker.
   */
  league?: string;
  mutuallyExclusive: boolean;
  markets: Market[];
  totalVolume: number;
  volume24h: number;
  /** Soonest market close across the event. */
  closeTime?: string;
  /** True when at least one market is open/tradeable. */
  isLive: boolean;
  /**
   * Id of an existing COMPLETE prediction for this event (by any user), if one
   * exists. When set, the event can be viewed for free without re-generating.
   */
  freePredictionId?: string | null;
}

export interface CandlePoint {
  ts: number; // ms epoch
  /** Implied YES probability 0-100 (null if no data that period). */
  close: number | null;
  volume: number;
}
