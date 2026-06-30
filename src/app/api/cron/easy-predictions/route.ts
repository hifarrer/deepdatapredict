import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedLiveEvents } from "@/lib/kalshi/cache";
import { buildEasyPicks } from "@/lib/ai/easy";
import { isAuthorizedCron } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Long-running: one screening call plus ~20 light web-search estimates. Set a
// generous limit (the deploy platform enforces it) and a matching request
// timeout on the external scheduler (cron-job.org).
export const maxDuration = 300;

/**
 * Rebuild the curated "Easy Predictions" snapshot: screen every cached live
 * event for predictability, keep the top picks, and attach a quick per-outcome
 * AI estimate to each. Meant to be called on a schedule by an external
 * scheduler. Protected by a `?token=<CRON_SECRET>` query parameter.
 */
async function handle(req: Request) {
  const { searchParams } = new URL(req.url);
  if (!isAuthorizedCron(searchParams.get("token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const events = await getCachedLiveEvents();
    const picks = await buildEasyPicks(events);

    await prisma.easyPicksSnapshot.upsert({
      where: { id: "live" },
      update: {
        picks: picks as never,
        count: picks.length,
        fetchedAt: new Date(),
      },
      create: {
        id: "live",
        picks: picks as never,
        count: picks.length,
      },
    });

    return NextResponse.json({
      ok: true,
      count: picks.length,
      scanned: events.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Easy predictions refresh failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// External schedulers trigger this via GET.
export const GET = handle;
