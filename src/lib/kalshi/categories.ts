// Canonical Kalshi-style category ordering + accent colors for the UI.
// Tabs are still built from whatever categories actually appear in the data;
// this only controls ordering and styling.

export const CATEGORY_ORDER = [
  "Politics",
  "Elections",
  "Economics",
  "Finance",
  "Crypto",
  "Commodities",
  "Sports",
  "Culture",
  "Climate",
  "Science and Technology",
  "Tech & Science",
  "World",
  "Health",
  "Companies",
  "Entertainment",
];

const CATEGORY_COLORS: Record<string, string> = {
  Politics: "#7c3aed",
  Elections: "#2563eb",
  Economics: "#0891b2",
  Finance: "#059669",
  Crypto: "#f59e0b",
  Commodities: "#b45309",
  Sports: "#dc2626",
  Culture: "#db2777",
  Climate: "#16a34a",
  "Science and Technology": "#4f46e5",
  "Tech & Science": "#4f46e5",
  World: "#0d9488",
  Health: "#e11d48",
  Companies: "#475569",
  Entertainment: "#9333ea",
  Other: "#64748b",
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;
}

/** Order a set of category names by the canonical list; unknowns trail alphabetically. */
export function orderCategories(categories: Iterable<string>): string[] {
  const unique = Array.from(new Set(categories));
  return unique.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
