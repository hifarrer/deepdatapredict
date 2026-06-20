import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
