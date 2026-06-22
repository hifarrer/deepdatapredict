import { prisma } from "@/lib/db";
import { getLiveEvents } from "./client";
import type { EventSummary } from "./types";

// Small in-memory micro-cache so rapid polling doesn't hit the DB every time.
// The authoritative cache is the EventSnapshot row, refreshed by the cron
// endpoint (/api/cron/refresh).
const TTL_MS = 10_000;

let cache: { at: number; events: EventSummary[] } | null = null;
let inflight: Promise<EventSummary[]> | null = null;

async function loadSnapshot(): Promise<EventSummary[]> {
  const row = await prisma.eventSnapshot.findUnique({ where: { id: "live" } });
  const events = (row?.events as EventSummary[] | undefined) ?? [];
  if (events.length > 0) return events;
  // Cold DB (cron hasn't run yet): fall back to a direct live fetch so the
  // site still works. This is the only path that hits Kalshi at request time.
  return getLiveEvents();
}

/** Live events read from the cron-refreshed DB snapshot (micro-cached). */
export async function getCachedLiveEvents(): Promise<EventSummary[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.events;
  if (inflight) return inflight;
  inflight = loadSnapshot()
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

/**
 * Drop the in-memory micro-cache so the next read reloads from the DB snapshot.
 * Called after importing an event by URL so it shows up immediately instead of
 * waiting out the TTL.
 */
export function resetLiveCache(): void {
  cache = null;
}
