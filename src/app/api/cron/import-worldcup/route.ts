import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSeriesByCategory,
  getLiveEventsBySeries,
  sleep,
} from "@/lib/kalshi/client";
import { isWorldCupSeries } from "@/lib/kalshi/sports";
import { orderCategories } from "@/lib/kalshi/categories";
import { resetLiveCache } from "@/lib/kalshi/cache";
import { isAuthorizedCron } from "@/lib/env";
import type { EventSummary } from "@/lib/kalshi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Small throttle between per-series pulls, matching the cron sweep, so Kalshi
// doesn't rate-limit a burst of series requests.
const SERIES_DELAY_MS = 200;

/**
 * Import every live World Cup event into the snapshot on demand. The scheduled
 * refresh now also picks up World Cup series (see prioritySeriesRank), so this
 * endpoint exists to apply the import immediately without waiting for the cron.
 * Unlike the balanced refresh it imports ALL World Cup events, ignoring caps.
 * Protected by a `?token=<CRON_SECRET>` query parameter.
 */
async function handle(req: Request) {
  const { searchParams } = new URL(req.url);
  if (!isAuthorizedCron(searchParams.get("token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Discover the World Cup series among Sports (e.g. the KXWC* family).
    const series = await getSeriesByCategory("Sports");
    const worldCup = series.filter((s) => isWorldCupSeries(s.ticker, s.title));

    // Pull all live events per matched series, deduped by event ticker.
    const imported = new Map<string, EventSummary>();
    for (const s of worldCup) {
      const evs = await getLiveEventsBySeries(s.ticker);
      for (const e of evs) {
        if (!imported.has(e.eventTicker)) imported.set(e.eventTicker, e);
      }
      await sleep(SERIES_DELAY_MS);
    }
    const worldCupEvents = [...imported.values()];

    // Merge into the live snapshot (World Cup events first), dedup by ticker.
    const row = await prisma.eventSnapshot.findUnique({ where: { id: "live" } });
    const existing = (row?.events as EventSummary[] | undefined) ?? [];
    const rest = existing.filter((e) => !imported.has(e.eventTicker));
    const events = [...worldCupEvents, ...rest];
    const categories = orderCategories(events.map((e) => e.category));

    await prisma.eventSnapshot.upsert({
      where: { id: "live" },
      update: {
        events: events as never,
        categories: categories as never,
        count: events.length,
      },
      create: {
        id: "live",
        events: events as never,
        categories: categories as never,
        count: events.length,
      },
    });
    resetLiveCache();

    return NextResponse.json({
      ok: true,
      seriesMatched: worldCup.map((s) => s.ticker),
      imported: worldCupEvents.length,
      count: events.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "World Cup import failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const GET = handle;
