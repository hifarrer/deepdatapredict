import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { EventSummary } from "@/lib/kalshi/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type SortKey = "featured" | "closing" | "volume" | "volume24h" | "confidence";

/**
 * "Market confidence": how lopsided the leading outcome is.
 * Multi-outcome events → (top probability − second). Single binary market →
 * distance of the implied complement, i.e. |p − (100 − p)|. Higher = more decided.
 */
export function marketConfidence(event: EventSummary): number {
  const probs = event.markets
    .map((m) => m.lastProbability ?? m.yesBid ?? m.yesAsk)
    .filter((p): p is number => p != null);
  if (probs.length === 0) return -1; // unknown → sorts last
  if (probs.length === 1) return Math.abs(probs[0] - (100 - probs[0]));
  const sorted = [...probs].sort((a, b) => b - a);
  return sorted[0] - sorted[1];
}

/** Comparator for the chosen sort. "featured" preserves the server order. */
export function compareEvents(
  key: SortKey
): (a: EventSummary, b: EventSummary) => number {
  switch (key) {
    case "closing":
      // Soonest first; events with no close time sort last.
      return (a, b) =>
        (a.closeTime ? new Date(a.closeTime).getTime() : Infinity) -
        (b.closeTime ? new Date(b.closeTime).getTime() : Infinity);
    case "volume":
      return (a, b) => b.totalVolume - a.totalVolume;
    case "volume24h":
      return (a, b) => b.volume24h - a.volume24h;
    case "confidence":
      return (a, b) => marketConfidence(b) - marketConfidence(a);
    case "featured":
    default:
      return () => 0;
  }
}

/** Format a USD volume like Kalshi ("$253,893 vol"). */
export function formatVolume(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** Probability (0-100) → "47%". */
export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

/** Relative-time-ish date for cards/history. */
export function formatDate(input: string | number | Date | null | undefined): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(input: string | number | Date | null | undefined): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Direct link to an event's page on kalshi.com. Kalshi's web routes live under
 * the (lowercase) series ticker; we prefer the explicit seriesTicker and fall
 * back to the prefix of the event ticker (everything before the first "-").
 */
export function kalshiEventUrl(
  eventTicker: string,
  seriesTicker?: string | null
): string {
  const series = (seriesTicker || eventTicker.split("-")[0] || eventTicker)
    .trim()
    .toLowerCase();
  return `https://kalshi.com/markets/${series}`;
}

/** Days between now and a future date (can be negative). */
export function daysUntil(input: string | number | Date | null | undefined): number | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
