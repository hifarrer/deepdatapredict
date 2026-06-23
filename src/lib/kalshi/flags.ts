// Maps a national-team name (as Kalshi labels it) to a flag image on flagcdn.
// flagcdn keys flags by ISO 3166-1 alpha-2 code, plus the GB home-nation
// subdivisions (gb-eng, gb-sct, …) FIFA fields as separate teams. Used to show a
// flag beside each country in the World Cup section; gated on that league so a
// stray "Georgia"/"Jordan"-style name elsewhere never picks up a flag.
//
// Kalshi's naming has a few quirks worth noting: "IR Iran", "Korea Republic" /
// "Republic of Korea", "Congo DR", "Turkiye", "Czechia", "USA". Aliases below
// cover the common variants so every spelling resolves.

const COUNTRY_CODES: Record<string, string> = {
  // 2026 World Cup field + common qualifiers / national teams.
  Afghanistan: "af",
  Albania: "al",
  Algeria: "dz",
  Angola: "ao",
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  Bolivia: "bo",
  "Bosnia and Herzegovina": "ba",
  Brazil: "br",
  Bulgaria: "bg",
  Cameroon: "cm",
  Canada: "ca",
  "Cape Verde": "cv",
  Chile: "cl",
  China: "cn",
  Colombia: "co",
  "Congo DR": "cd",
  "DR Congo": "cd",
  "Costa Rica": "cr",
  "Cote d'Ivoire": "ci",
  Croatia: "hr",
  Curacao: "cw",
  Czechia: "cz",
  "Czech Republic": "cz",
  Denmark: "dk",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  Finland: "fi",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Greece: "gr",
  Haiti: "ht",
  Honduras: "hn",
  Hungary: "hu",
  Iceland: "is",
  Iran: "ir",
  "IR Iran": "ir",
  Iraq: "iq",
  Ireland: "ie",
  Italy: "it",
  "Ivory Coast": "ci",
  Jamaica: "jm",
  Japan: "jp",
  Jordan: "jo",
  "Korea Republic": "kr",
  "Republic of Korea": "kr",
  "South Korea": "kr",
  "Korea DPR": "kp",
  "North Korea": "kp",
  Mexico: "mx",
  Morocco: "ma",
  Netherlands: "nl",
  "New Zealand": "nz",
  Nigeria: "ng",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Peru: "pe",
  Poland: "pl",
  Portugal: "pt",
  Qatar: "qa",
  Romania: "ro",
  Russia: "ru",
  "Saudi Arabia": "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  Serbia: "rs",
  Slovakia: "sk",
  Slovenia: "si",
  "South Africa": "za",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Tunisia: "tn",
  Turkiye: "tr",
  Turkey: "tr",
  Ukraine: "ua",
  "United States": "us",
  USA: "us",
  Uruguay: "uy",
  Uzbekistan: "uz",
  Venezuela: "ve",
  Wales: "gb-wls",
};

// Case-insensitive lookup keyed on the normalized name.
const LOOKUP = new Map<string, string>(
  Object.entries(COUNTRY_CODES).map(([name, code]) => [name.toLowerCase(), code])
);

/** ISO code (or GB subdivision) for a national-team name, else undefined. */
export function countryCode(name: string): string | undefined {
  return LOOKUP.get(name.trim().toLowerCase());
}

/**
 * flagcdn PNG URL for a national-team name, or undefined when the name isn't a
 * known country. `width` is one of flagcdn's offered widths (20, 40, 80, …); the
 * image is 4:3, so a 40px-wide flag is 30px tall.
 */
export function flagUrl(name: string, width: 20 | 40 | 80 = 40): string | undefined {
  const code = countryCode(name);
  return code ? `https://flagcdn.com/w${width}/${code}.png` : undefined;
}

/** True when the name resolves to a known country flag. */
export function hasFlag(name: string): boolean {
  return countryCode(name) !== undefined;
}

/**
 * Split a matchup title ("France vs Iraq") into its two sides, or null when the
 * title isn't a head-to-head matchup. Used to flag both teams in the card header.
 * A trailing prop suffix is dropped first ("Portugal vs Uzbekistan: Goalscorer"
 * → Portugal / Uzbekistan) so prop events still flag both teams.
 */
export function splitMatchup(title: string): [string, string] | null {
  const base = title.split(":")[0].trim();
  const m = /^(.+?)\s+vs\.?\s+(.+)$/i.exec(base);
  if (!m) return null;
  return [m[1].trim(), m[2].trim()];
}
