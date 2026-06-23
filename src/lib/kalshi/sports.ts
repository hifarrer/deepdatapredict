import type { EventSummary } from "./types";

// Classify a Kalshi "Sports" event into a specific sport. Kalshi encodes the
// league in the series ticker (e.g. KXNBA*, KXNFL*, KXEPL*), so we match on the
// ticker first and fall back to title keywords. Anything unmatched is "Other".
//
// This is heuristic by nature — new leagues may need a token added below.

/** Canonical display order for sport sub-filters and admin inputs. */
export const SPORTS_ORDER = [
  "Football",
  "Basketball",
  "Baseball",
  "Hockey",
  "Soccer",
  "Golf",
  "Tennis",
  "MMA",
  "Racing",
  "Cricket",
  "Darts",
  "Other",
];

// Ordered rules: the first sport whose token appears in the series ticker wins.
// Order matters where tokens could overlap (e.g. NCAAMB before NCAAF tokens).
const TICKER_RULES: Array<{ sport: string; tokens: string[] }> = [
  { sport: "Basketball", tokens: ["NBA", "WNBA", "NCAAMB", "NCAAWB", "MARMAD", "BBALL", "SONICS"] },
  { sport: "Football", tokens: ["NFL", "NCAAF", "KXSB", "SBHOST", "RANKLISTFF", "NDJOIN", "RELOCATIONCHI", "SORONDO"] },
  { sport: "Baseball", tokens: ["MLB"] },
  { sport: "Hockey", tokens: ["NHL", "CANADACUP", "STANLEY"] },
  { sport: "Soccer", tokens: ["UCL", "EPL", "PREMIERLEAGUE", "LALIGA", "LIGA", "RONALDO", "WCHOST", "SERIEA", "BUNDES", "MLS"] },
  { sport: "Golf", tokens: ["PGA", "RYDER", "LIVCOMPETE", "SCOTTIE", "GOLF"] },
  { sport: "Tennis", tokens: ["ATP", "WTA", "SINNER", "ALCARAZ", "DJOKO"] },
  { sport: "MMA", tokens: ["MCGREGOR", "UFC", "MMA"] },
  { sport: "Racing", tokens: ["F1", "NASCAR", "INDYCAR", "VERSTAPPEN"] },
  { sport: "Cricket", tokens: ["IPL", "CRICKET"] },
  { sport: "Darts", tokens: ["DARTS"] },
];

// Title-keyword fallback when the ticker doesn't match a known league token.
const TITLE_RULES: Array<{ sport: string; keywords: string[] }> = [
  { sport: "Football", keywords: ["football"] },
  { sport: "Basketball", keywords: ["basketball"] },
  { sport: "Baseball", keywords: ["baseball"] },
  { sport: "Hockey", keywords: ["hockey", "stanley cup"] },
  { sport: "Soccer", keywords: ["soccer", "premier league", "champions league", "la liga"] },
  { sport: "Golf", keywords: ["golf", "ryder cup"] },
  { sport: "Tennis", keywords: ["tennis"] },
];

// Kalshi runs several unrelated tournaments under "World Cup" branding that
// collide on the obvious tokens, so they're excluded from the FIFA soccer check:
//  - Esports World Cup: KXEWC* tickers / "esports" titles
//  - Cricket T20 World Cup: *T20WORLDCUP* tickers
//  - West Coast Conference (college basketball): collides on the KXWCC* prefix
const NON_SOCCER_WC_TICKERS = new Set(["KXWCCREG"]);

/**
 * True for Kalshi FIFA (soccer) World Cup series. Kalshi's World Cup series ride
 * the KXWC* / *WORLDCUP* / CLUBWC / PLAYWC ticker families (or carry a "World
 * Cup" title) rather than the generic league tokens, so they need their own
 * check — with same-name non-soccer tournaments filtered out first.
 */
export function isWorldCupSeries(ticker: string | undefined, title?: string): boolean {
  const t = (ticker ?? "").toUpperCase();
  const l = (title ?? "").toLowerCase();

  if (NON_SOCCER_WC_TICKERS.has(t)) return false;
  if (t.startsWith("KXEWC") || l.includes("esports")) return false;
  if (t.includes("T20WORLDCUP") || l.includes("t20 world cup")) return false;

  return (
    t.startsWith("KXWC") ||
    t.includes("WORLDCUP") ||
    t.includes("WORLDSOCCERCUP") ||
    t.includes("CLUBWC") ||
    t.includes("PLAYWC") ||
    l.includes("world cup") ||
    l.includes("world soccer cup")
  );
}

/**
 * Returns the sport for a Sports-category event, or undefined for non-sports
 * categories. Never returns undefined for a Sports event — falls back to "Other".
 */
export function sportForEvent(
  category: string,
  seriesTicker: string | undefined,
  title: string | undefined
): string | undefined {
  if (category !== "Sports") return undefined;

  // World Cup series (KXWC*, "World Cup" titles) don't match the soccer league
  // tokens below, so classify them as Soccer up front; leagueForEvent then
  // resolves the "World Cup" league for them.
  if (isWorldCupSeries(seriesTicker, title)) return "Soccer";

  const ticker = (seriesTicker ?? "").toUpperCase();
  for (const { sport, tokens } of TICKER_RULES) {
    if (tokens.some((t) => ticker.includes(t))) return sport;
  }

  const lowerTitle = (title ?? "").toLowerCase();
  for (const { sport, keywords } of TITLE_RULES) {
    if (keywords.some((k) => lowerTitle.includes(k))) return sport;
  }

  return "Other";
}

/** Order a set of sport names by the canonical list; unknowns trail alphabetically. */
export function orderSports(sports: Iterable<string>): string[] {
  const unique = Array.from(new Set(sports));
  return unique.sort((a, b) => {
    const ia = SPORTS_ORDER.indexOf(a);
    const ib = SPORTS_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// ---- League / competition grouping (one tier below sport) ----
//
// Kalshi groups each sport by league (World Cup, MLS, EPL, …). Like sports, the
// league is encoded in the series ticker, so we match curated tokens to a nice
// display name. Tokens here must be MORE specific than the sport tokens above —
// a broad token like "LIGA" can't pin a single league, so it's left out and such
// events fall back to a cleaned-up ticker label instead of being mislabeled.
const LEAGUE_RULES: Array<{ sport: string; league: string; tokens: string[] }> = [
  // Soccer. World Cup first so its broad ticker family (KXWC*, KXFIFA*) wins
  // over the other soccer leagues. "WC"/"FIFA" are safe here because these rules
  // only apply to events already classified as Soccer.
  { sport: "Soccer", league: "World Cup", tokens: ["WORLDCUP", "WORLDSOCCERCUP", "WCHOST", "FIFAWC", "FIFA", "WC"] },
  { sport: "Soccer", league: "Premier League", tokens: ["EPL", "PREMIERLEAGUE"] },
  { sport: "Soccer", league: "Champions League", tokens: ["UCL", "CHAMPIONSLEAGUE"] },
  { sport: "Soccer", league: "La Liga", tokens: ["LALIGA"] },
  { sport: "Soccer", league: "Serie A", tokens: ["SERIEA"] },
  { sport: "Soccer", league: "Bundesliga", tokens: ["BUNDES"] },
  { sport: "Soccer", league: "MLS", tokens: ["MLS"] },
  { sport: "Soccer", league: "NWSL", tokens: ["NWSL"] },
  { sport: "Soccer", league: "USL Championship", tokens: ["USL"] },
  // Basketball
  { sport: "Basketball", league: "NBA", tokens: ["NBA"] },
  { sport: "Basketball", league: "WNBA", tokens: ["WNBA"] },
  { sport: "Basketball", league: "NCAA Men's", tokens: ["NCAAMB", "MARMAD"] },
  { sport: "Basketball", league: "NCAA Women's", tokens: ["NCAAWB"] },
  // Football
  { sport: "Football", league: "Super Bowl", tokens: ["KXSB", "SBHOST"] },
  { sport: "Football", league: "NFL", tokens: ["NFL"] },
  { sport: "Football", league: "College Football", tokens: ["NCAAF"] },
  // Baseball
  { sport: "Baseball", league: "MLB", tokens: ["MLB"] },
  // Hockey
  { sport: "Hockey", league: "NHL", tokens: ["NHL", "STANLEY"] },
  // Golf
  { sport: "Golf", league: "PGA Tour", tokens: ["PGA"] },
  { sport: "Golf", league: "Ryder Cup", tokens: ["RYDER"] },
  { sport: "Golf", league: "LIV Golf", tokens: ["LIV"] },
  // Tennis
  { sport: "Tennis", league: "ATP", tokens: ["ATP"] },
  { sport: "Tennis", league: "WTA", tokens: ["WTA"] },
  // MMA
  { sport: "MMA", league: "UFC", tokens: ["UFC"] },
  // Racing
  { sport: "Racing", league: "Formula 1", tokens: ["F1", "VERSTAPPEN"] },
  { sport: "Racing", league: "NASCAR", tokens: ["NASCAR"] },
  { sport: "Racing", league: "IndyCar", tokens: ["INDYCAR"] },
  // Cricket
  { sport: "Cricket", league: "IPL", tokens: ["IPL"] },
];

// Title-keyword fallback for leagues whose ticker doesn't carry a known token
// (e.g. World Cup prop markets like "World Soccer Cup: Hattricks"). Checked after
// ticker rules; keeps the long tail of related markets grouped under one league.
const LEAGUE_TITLE_RULES: Array<{ sport: string; league: string; keywords: string[] }> = [
  { sport: "Soccer", league: "World Cup", keywords: ["world cup", "world soccer cup"] },
  { sport: "Soccer", league: "Premier League", keywords: ["premier league"] },
  { sport: "Soccer", league: "Champions League", keywords: ["champions league"] },
  { sport: "Soccer", league: "La Liga", keywords: ["la liga"] },
  { sport: "Soccer", league: "Serie A", keywords: ["serie a"] },
  { sport: "Soccer", league: "Bundesliga", keywords: ["bundesliga"] },
  { sport: "Soccer", league: "MLS", keywords: ["mls cup", "major league soccer"] },
];

// Trailing market-type suffixes Kalshi appends to a series ticker that aren't
// part of the league name (e.g. KXEPLGAME -> "EPL", KXNBASERIESWINNER -> "NBA").
const TICKER_SUFFIXES = [
  "GAMEWINNER",
  "SERIESWINNER",
  "WINNER",
  "CHAMP",
  "GAME",
  "MATCH",
  "WIN",
];

/**
 * Best-effort readable league label from a raw series ticker, for leagues not in
 * LEAGUE_RULES. Strips the leading "KX", drops a trailing market-type suffix, and
 * Title-Cases the remainder. Returns "Other" when there's no ticker to work with.
 */
export function prettyLeagueFromTicker(seriesTicker: string | undefined): string {
  let t = (seriesTicker ?? "").toUpperCase().trim();
  if (!t) return "Other";
  if (t.startsWith("KX")) t = t.slice(2);
  for (const suffix of TICKER_SUFFIXES) {
    if (t.length > suffix.length && t.endsWith(suffix)) {
      t = t.slice(0, -suffix.length);
      break;
    }
  }
  if (!t) return "Other";
  // Title-case the cleaned token (it's a single run of letters/digits).
  return t.charAt(0) + t.slice(1).toLowerCase();
}

/**
 * Returns the league/competition for a Sports event, or undefined for non-sports.
 * Matches a curated league for the event's sport, else falls back to a cleaned-up
 * ticker label. The returned name is also the grouping key, so multiple series
 * resolving to the same name merge together.
 */
export function leagueForEvent(
  sport: string | undefined,
  seriesTicker: string | undefined,
  title?: string
): string | undefined {
  if (!sport) return undefined;

  const ticker = (seriesTicker ?? "").toUpperCase();
  for (const { sport: s, league, tokens } of LEAGUE_RULES) {
    if (s !== sport) continue;
    if (tokens.some((t) => ticker.includes(t))) return league;
  }

  const lowerTitle = (title ?? "").toLowerCase();
  for (const { sport: s, league, keywords } of LEAGUE_TITLE_RULES) {
    if (s !== sport) continue;
    if (keywords.some((k) => lowerTitle.includes(k))) return league;
  }

  return prettyLeagueFromTicker(seriesTicker);
}

// League tokens the cron's targeted sweep pulls in full by series, so marquee
// leagues are complete regardless of where they fall in Kalshi's global feed.
// Soccer is listed first so it wins the capped sweep budget (the live World Cup
// is the priority); other majors follow.
const PRIORITY_LEAGUE_TOKENS = [
  "WORLDCUP", "FIFA", "UEFA", "UCL", "EPL", "PREMIERLEAGUE", "LALIGA",
  "SERIEA", "BUNDES", "MLS", "NWSL", // soccer
  "NBA", "WNBA", "NFL", "MLB", "NHL", // other majors
];

/**
 * Rank a series ticker for the targeted sweep: lower = higher priority, -1 =
 * not a priority series (skip). Live "game" series outrank season-long futures
 * within the same league, and earlier tokens (soccer) outrank later ones.
 */
export function prioritySeriesRank(ticker: string, title?: string): number {
  const t = (ticker ?? "").toUpperCase();
  // World Cup is the priority — its series ride the KXWC* family rather than the
  // WORLDCUP/FIFA tokens below, so rank them top explicitly.
  if (isWorldCupSeries(ticker, title)) return 0;
  const idx = PRIORITY_LEAGUE_TOKENS.findIndex((tok) => t.includes(tok));
  if (idx === -1) return -1;
  const isGame = /GAME|ADVANCE|SPREAD|TOTAL|MATCH/.test(t) ? 0 : 1;
  return idx * 2 + isGame;
}

/** Order leagues by live-event count (desc), ties broken alphabetically. */
export function orderLeagues(counts: Map<string, number>): string[] {
  return Array.from(counts.keys()).sort((a, b) => {
    const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
}

// ---- Match grouping (one tier below league) ----
//
// Kalshi splits a single match into many events: the match itself ("Norway vs
// Senegal") plus a prop event per market type ("Norway vs Senegal: Goalscorer",
// "…: Total Goals", "…: Spread"). The props all share the matchup as a title
// prefix, with the prop name after a colon, so the matchup text is a reliable
// grouping key and the colon's absence marks the main match event.

/**
 * Grouping key for a Sports event: the matchup ("team a vs team b"), i.e. the
 * title with any trailing ": <prop>" suffix removed and normalized. Every event
 * for one match shares this key; tournament-wide futures ("World Cup: Top
 * Scorer") group under their own prefix, which is harmless.
 */
export function matchGroupKey(title: string): string {
  return title.split(":")[0].trim().toLowerCase();
}

/**
 * True when a Sports event is the match itself rather than one of its prop
 * sub-events. Kalshi names props "<Matchup>: <Prop>", so a title with no colon
 * is the main match.
 */
export function isMainMatchEvent(title: string): boolean {
  return !title.includes(":");
}

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/**
 * Kickoff day (UTC midnight, ms) parsed from a dated game ticker, or null when
 * the ticker carries no date. Kalshi encodes a match's date in the ticker code
 * after the series prefix: "KXWCGAME-26JUN22FRAIRQ" → 22 Jun 2026. The market
 * open/close times are useless for ordering (they span the whole tournament), so
 * this ticker date is the only reliable kickoff signal. Tournament-wide futures
 * ("KXWCWINGROUP-26HOST", "KXWCGROUPBOTTOM-26C") have no month/day and return
 * null. Day granularity is all the ticker carries — no kickoff time of day.
 */
export function matchDateFromTicker(eventTicker: string | undefined): number | null {
  if (!eventTicker) return null;
  const dash = eventTicker.indexOf("-");
  const code = (dash === -1 ? eventTicker : eventTicker.slice(dash + 1)).toUpperCase();
  const m = /^(\d{2})([A-Z]{3})(\d{2})/.exec(code);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (month === undefined) return null;
  const ts = Date.UTC(2000 + Number(m[1]), month, Number(m[3]));
  return Number.isNaN(ts) ? null : ts;
}

/**
 * UTC-midnight ms of *today's* date in US Eastern time. Kalshi (a US exchange)
 * labels game tickers by their Eastern calendar date, so "today" must be the ET
 * date — otherwise a 10pm-ET match flips to "past" the moment UTC ticks midnight
 * (i.e. 8pm ET), sinking tonight's games. Matches the encoding of
 * {@link matchDateFromTicker} so the two are directly comparable.
 */
export function startOfTodayEastern(now: Date = new Date()): number {
  const [month, day, year] = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("/")
    .map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * Re-order events so each match's events sit together with the main match event
 * first and its prop sub-events (Goalscorer, Total Goals, Spread, …) after it,
 * the way Kalshi's league pages group them. Only Sports events are grouped;
 * everything else stays a singleton at its original position.
 *
 * Cross-group order: with `byKickoff`, today's and upcoming matches lead, by
 * kickoff date (today first, then later days) — the way Kalshi's league pages
 * read. Tournament-wide futures (group winners, top scorer, …) follow, then
 * already-played matches sink to the bottom. Otherwise the incoming order is
 * preserved, with each match's events pulled together at the position of its
 * strongest member.
 *
 * With `mainsFirst`, the match prop sub-events are lifted below everything else,
 * so the list reads as a clean run of the actual matches (and, in a mixed list,
 * the non-sports events) first, then the props grouped per match underneath —
 * rather than each match's props sandwiched between it and the next match. Only
 * Sports props sink; both tiers keep the match order above.
 */
export function orderByMatch(
  events: EventSummary[],
  {
    byKickoff = false,
    mainsFirst = false,
  }: { byKickoff?: boolean; mainsFirst?: boolean } = {}
): EventSummary[] {
  const groups = new Map<string, EventSummary[]>();
  const firstIndex = new Map<string, number>();
  events.forEach((e, i) => {
    // Non-sports events are never merged: key them by their own ticker so each
    // forms a singleton group and keeps its place.
    const key =
      e.category === "Sports" ? `m:${matchGroupKey(e.title)}` : `e:${e.eventTicker}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      firstIndex.set(key, i);
    }
    groups.get(key)!.push(e);
  });

  // Within a match: the main event first, then props by volume (most-traded
  // prop next), so the actual match never sits below its own sub-markets.
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const am = isMainMatchEvent(a.title) ? 0 : 1;
      const bm = isMainMatchEvent(b.title) ? 0 : 1;
      if (am !== bm) return am - bm;
      return b.totalVolume - a.totalVolume;
    });
  }

  // Per match: its kickoff day (from the ticker — shared by every event in the
  // group) and combined volume.
  const dateByKey = new Map<string, number | null>();
  const volByKey = new Map<string, number>();
  for (const [key, list] of groups) {
    let date: number | null = null;
    let vol = 0;
    for (const e of list) {
      vol += e.totalVolume;
      const d = matchDateFromTicker(e.eventTicker);
      if (d !== null && (date === null || d < date)) date = d;
    }
    dateByKey.set(key, date);
    volByKey.set(key, vol);
  }

  // Day boundary for "today" (Eastern, to match Kalshi's ticker dates): a match
  // earlier today is still live/today, not past.
  const startOfToday = startOfTodayEastern();

  // Bucket: 0 = today/upcoming dated match, 1 = undated tournament future,
  // 2 = already-played match. Lower buckets lead.
  const bucketOf = (date: number | null) =>
    date === null ? 1 : date >= startOfToday ? 0 : 2;

  const keys = Array.from(groups.keys());
  keys.sort((a, b) => {
    if (byKickoff) {
      const da = dateByKey.get(a) ?? null;
      const db = dateByKey.get(b) ?? null;
      const ba = bucketOf(da);
      const bb = bucketOf(db);
      if (ba !== bb) return ba - bb;
      // Upcoming matches by date ascending (today, then later days); past matches
      // most-recent first; futures by volume. Same day/bucket breaks on volume.
      if (ba === 0 && da !== db) return da! - db!;
      if (ba === 2 && da !== db) return db! - da!;
      const dv = volByKey.get(b)! - volByKey.get(a)!;
      if (dv !== 0) return dv;
    }
    return firstIndex.get(a)! - firstIndex.get(b)!;
  });

  const orderedGroups = keys.map((k) => groups.get(k)!);
  if (!mainsFirst) return orderedGroups.flat();

  // Two tiers: main events first (in match order), then the prop sub-events
  // (still grouped per match, in the same order) underneath. Only Sports props
  // drop to the lower tier — non-sports events (whose titles can carry a ":" for
  // unrelated reasons) and the match itself always stay in the top tier, so a
  // mixed list like "All" keeps its other events up top and just sinks the props.
  const mains: EventSummary[] = [];
  const subs: EventSummary[] = [];
  for (const list of orderedGroups) {
    for (const e of list) {
      const isSportsProp = e.category === "Sports" && !isMainMatchEvent(e.title);
      (isSportsProp ? subs : mains).push(e);
    }
  }
  return [...mains, ...subs];
}
