import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEvent } from "@/lib/kalshi/client";
import { parseKalshiEventTicker } from "@/lib/kalshi/url";
import { resetLiveCache } from "@/lib/kalshi/cache";
import { addManualEventTicker } from "@/lib/settings";
import type { EventSummary } from "@/lib/kalshi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Import a Kalshi event by URL. Resolves the event ticker, fetches the event
 * live from Kalshi, records it in the persistent manual list (so the cron
 * re-merges it on every refresh), and injects it into the current snapshot so it
 * appears in the list immediately.
 */
export async function POST(req: Request) {
  let url: string;
  try {
    const body = await req.json();
    url = typeof body?.url === "string" ? body.url : "";
  } catch {
    url = "";
  }

  const ticker = parseKalshiEventTicker(url);
  if (!ticker) {
    return NextResponse.json(
      { error: "Couldn't read a Kalshi event URL." },
      { status: 400 }
    );
  }

  try {
    const event = await getEvent(ticker);
    if (!event) {
      return NextResponse.json(
        { error: "That event wasn't found on Kalshi." },
        { status: 404 }
      );
    }
    const imported: EventSummary = { ...event, manual: true };

    // Persist the ticker so the cron sweep keeps re-merging it on every refresh.
    await addManualEventTicker(ticker);

    // Inject into the current snapshot now (dedup by ticker), so it's in the
    // list without waiting for the next cron run.
    const row = await prisma.eventSnapshot.findUnique({ where: { id: "live" } });
    const existing = (row?.events as EventSummary[] | undefined) ?? [];
    const rest = existing.filter((e) => e.eventTicker !== imported.eventTicker);
    const events = [imported, ...rest];
    await prisma.eventSnapshot.upsert({
      where: { id: "live" },
      update: { events: events as never, count: events.length },
      create: {
        id: "live",
        events: events as never,
        categories: (row?.categories as never) ?? ([] as never),
        count: events.length,
      },
    });
    resetLiveCache();

    return NextResponse.json({ event: imported });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to import event";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
