import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { EasyPick } from "@/lib/ai/easy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve the curated "Easy Predictions" snapshot. Each pick's event is enriched
 * with `freePredictionId` (the most recent COMPLETE prediction for it, by any
 * user) — same as /api/events — so already-generated picks show "Free view".
 */
export async function GET() {
  try {
    const row = await prisma.easyPicksSnapshot.findUnique({ where: { id: "live" } });
    const picks = (row?.picks as EasyPick[] | undefined) ?? [];

    // Surface the latest completed prediction per event ticker (free re-view).
    const freeByTicker = new Map<string, string>();
    if (picks.length > 0) {
      const completed = await prisma.prediction.findMany({
        where: {
          eventTicker: { in: picks.map((p) => p.event.eventTicker) },
          status: "COMPLETE",
        },
        select: { id: true, eventTicker: true },
        orderBy: { completedAt: "desc" },
      });
      for (const c of completed) {
        if (!freeByTicker.has(c.eventTicker)) freeByTicker.set(c.eventTicker, c.id);
      }
    }

    const enriched: EasyPick[] = picks.map((p) => ({
      ...p,
      event: {
        ...p.event,
        freePredictionId: freeByTicker.get(p.event.eventTicker) ?? null,
      },
    }));

    return NextResponse.json({
      picks: enriched,
      count: enriched.length,
      fetchedAt: row?.fetchedAt ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load easy predictions";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
