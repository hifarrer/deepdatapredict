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
