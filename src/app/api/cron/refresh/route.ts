import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  pageOpenEvents,
  getSeriesByCategory,
  getLiveEventsBySeries,
  getEvent,
  sleep,
} from "@/lib/kalshi/client";
import { orderCategories } from "@/lib/kalshi/categories";
import { prioritySeriesRank } from "@/lib/kalshi/sports";
import {
  getSiteSettings,
  getManualEventTickers,
  limitForCategory,
  limitForSport,
} from "@/lib/settings";
import { isAuthorizedCron } from "@/lib/env";
import type { EventSummary } from "@/lib/kalshi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tunables for the balanced refresh. The feed is paged with a throttle so Kalshi
// doesn't rate-limit us; the sweep fetches a bounded number of league series.
const FEED_PAGE_CEILING = 30;
const FEED_PAGE_DELAY_MS = 250;
const SWEEP_SERIES_LIMIT = 50;
const SWEEP_DELAY_MS = 200;

/**
 * Refresh the cached snapshot of live Kalshi events. Meant to be called on a
 * schedule (Vercel Cron or an external scheduler) so page loads read the cached
 * snapshot instead of hitting Kalshi on every request. Protected by a
 * `?token=<CRON_SECRET>` query parameter.
 *
 * Kalshi's global open-events feed is dominated by Elections, so a naive "first
 * N events" pull starves Sports. This refresh instead keeps the snapshot
 * *balanced*: it stores up to each category's (and sport's) configured limit,
 * and runs a targeted sports sweep — fetching marquee league series directly —
 * so live soccer/the World Cup is fully covered regardless of feed order.
 */
async function handle(req: Request) {
  const { searchParams } = new URL(req.url);
  if (!isAuthorizedCron(searchParams.get("token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getSiteSettings();

    // Balanced accumulator: admit an event only while its category and (for
    // Sports) its sport are under their configured caps, plus an overall
    // ceiling. Dominant categories stop early; sparse ones keep accruing.
    const kept = new Map<string, EventSummary>();
    const catCount = new Map<string, number>();
    const sportCount = new Map<string, number>();

    function tryAdd(e: EventSummary): boolean {
      if (!e.isLive || kept.has(e.eventTicker)) return false;
      if (kept.size >= settings.maxLiveEvents) return false;
      if ((catCount.get(e.category) ?? 0) >= limitForCategory(settings, e.category)) {
        return false;
      }
      const sport = e.category === "Sports" ? e.subCategory ?? "Other" : null;
      if (sport && (sportCount.get(sport) ?? 0) >= limitForSport(settings, sport)) {
        return false;
      }
      kept.set(e.eventTicker, e);
      catCount.set(e.category, (catCount.get(e.category) ?? 0) + 1);
      if (sport) sportCount.set(sport, (sportCount.get(sport) ?? 0) + 1);
      return true;
    }

    // 1) Targeted sports sweep FIRST, so marquee leagues claim their per-sport
    //    budget before the Elections-heavy feed competes for the snapshot.
    let sweptSeries = 0;
    try {
      const series = await getSeriesByCategory("Sports");
      const prioritized = series
        .map((s) => ({ ticker: s.ticker, rank: prioritySeriesRank(s.ticker) }))
        .filter((s) => s.rank >= 0)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, SWEEP_SERIES_LIMIT);
      for (const s of prioritized) {
        const evs = await getLiveEventsBySeries(s.ticker);
        for (const e of evs) tryAdd(e);
        sweptSeries++;
        await sleep(SWEEP_DELAY_MS);
      }
    } catch {
      // Sweep is best-effort; the balanced feed below still fills the snapshot.
    }

    // 2) Balanced global feed for non-sports categories (and any remaining
    //    sports budget). Paged with a throttle; stops on feed exhaustion, the
    //    overall ceiling, or the page ceiling.
    let cursor: string | undefined;
    let pages = 0;
    for (; pages < FEED_PAGE_CEILING; pages++) {
      const res = await pageOpenEvents(cursor, 200);
      for (const e of res.events) tryAdd(e);
      cursor = res.cursor;
      if (!cursor || kept.size >= settings.maxLiveEvents) break;
      await sleep(FEED_PAGE_DELAY_MS);
    }

    const events = [...kept.values()].sort((a, b) => b.totalVolume - a.totalVolume);

    // Re-merge URL-imported events so they persist across the rebuilt snapshot.
    // Best-effort: a ticker that no longer resolves (expired/removed) is skipped.
    try {
      const manualTickers = await getManualEventTickers();
      const present = new Set(events.map((e) => e.eventTicker));
      for (const ticker of manualTickers) {
        if (present.has(ticker)) continue;
        try {
          const ev = await getEvent(ticker);
          if (ev) {
            events.unshift({ ...ev, manual: true });
            present.add(ticker);
          }
        } catch {
          // Skip this ticker; the rest of the refresh still succeeds.
        }
        await sleep(SWEEP_DELAY_MS);
      }
    } catch {
      // No manual list / read failure — the snapshot is still valid without it.
    }

    const categories = orderCategories(events.map((e) => e.category));

    // Prisma's JSON input type rejects typed arrays without an index signature;
    // cast through `never` (as the settings layer does) to store the snapshot.
    const eventsJson = events as never;
    const categoriesJson = categories as never;
    await prisma.eventSnapshot.upsert({
      where: { id: "live" },
      update: {
        events: eventsJson,
        categories: categoriesJson,
        count: events.length,
        fetchedAt: new Date(),
      },
      create: {
        id: "live",
        events: eventsJson,
        categories: categoriesJson,
        count: events.length,
      },
    });

    // Per-category / per-sport counts make it easy to verify balance after a run.
    const byCategory: Record<string, number> = {};
    const bySport: Record<string, number> = {};
    for (const e of events) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
      if (e.category === "Sports") {
        const s = e.subCategory ?? "Other";
        bySport[s] = (bySport[s] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      ok: true,
      count: events.length,
      pages,
      sweptSeries,
      byCategory,
      bySport,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// Vercel Cron (and external schedulers) trigger this via GET.
export const GET = handle;
