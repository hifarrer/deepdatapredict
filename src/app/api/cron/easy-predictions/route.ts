import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedLiveEvents } from "@/lib/kalshi/cache";
import { buildEasyPicks, type EasyPick } from "@/lib/ai/easy";
import { isAuthorizedCron } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// No maxDuration: the handler returns in <1s (fire-and-forget). The multi-minute
// work runs AFTER the response on Railway's persistent process, so a route
// duration cap would not govern it anyway.

// In-memory guard so overlapping scheduler hits don't stack a second multi-minute
// run on top of one already in progress. Single Railway instance → in-process is
// enough; a restart simply clears it. `lastFinishedAt` aids quick inspection.
let running = false;
let startedAt: string | null = null;
let lastFinishedAt: string | null = null;
let lastError: string | null = null;

/**
 * Rebuild the curated "Easy Predictions" snapshot in the BACKGROUND: screen
 * every cached live event for predictability, keep the top picks, attach a quick
 * per-outcome AI estimate, and upsert the singleton row.
 *
 * The full job runs for several minutes (one screening call + ~20 light
 * web-search estimates), which is far longer than an external scheduler
 * (cron-job.org ~30s) or a proxy will wait. So this endpoint validates the
 * token, kicks the work off without awaiting it, and returns immediately. On a
 * persistent Node host (Railway) the process keeps running and finishes the job;
 * progress is observable via /api/easy-predictions (its `fetchedAt` updates when
 * the run completes). Protected by a `?token=<CRON_SECRET>` query parameter.
 */
async function runRefresh() {
  running = true;
  startedAt = new Date().toISOString();
  lastError = null;
  try {
    const events = await getCachedLiveEvents();
    // Pass the prior snapshot so unchanged picks are reused (no re-research).
    const prior = await prisma.easyPicksSnapshot.findUnique({ where: { id: "live" } });
    const priorPicks = (prior?.picks as EasyPick[] | undefined) ?? [];
    const picks = await buildEasyPicks(events, priorPicks);
    await prisma.easyPicksSnapshot.upsert({
      where: { id: "live" },
      update: { picks: picks as never, count: picks.length, fetchedAt: new Date() },
      create: { id: "live", picks: picks as never, count: picks.length },
    });
    lastFinishedAt = new Date().toISOString();
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Easy predictions refresh failed";
    console.error("[easy-predictions] refresh failed:", lastError);
  } finally {
    running = false;
    startedAt = null;
  }
}

function handle(req: Request) {
  const { searchParams } = new URL(req.url);
  if (!isAuthorizedCron(searchParams.get("token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (running) {
    return NextResponse.json(
      { ok: true, started: false, alreadyRunning: true, startedAt },
      { status: 202 }
    );
  }

  // Fire-and-forget: don't await. The floating promise finishes on Railway's
  // persistent process. Attach a catch so a failure never becomes an
  // unhandledRejection.
  void runRefresh().catch(() => {});

  return NextResponse.json(
    {
      ok: true,
      started: true,
      message: "Refresh started in the background; check /api/easy-predictions for results.",
      lastFinishedAt,
      lastError,
    },
    { status: 202 }
  );
}

// External schedulers trigger this via GET.
export const GET = handle;
