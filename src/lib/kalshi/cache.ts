import { getLiveEvents } from "./client";
import type { EventSummary } from "./types";

const TTL_MS = 45_000;

let cache: { at: number; events: EventSummary[] } | null = null;
let inflight: Promise<EventSummary[]> | null = null;

/** Live events with a short TTL cache shared across requests (cheap polling). */
export async function getCachedLiveEvents(): Promise<EventSummary[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.events;
  if (inflight) return inflight;
  inflight = getLiveEvents()
    .then((events) => {
      cache = { at: Date.now(), events };
      return events;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function cacheAgeMs(): number | null {
  return cache ? Date.now() - cache.at : null;
}
