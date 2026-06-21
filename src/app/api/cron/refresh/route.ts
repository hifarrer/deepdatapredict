import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAllLiveEvents } from "@/lib/kalshi/client";
import { orderCategories } from "@/lib/kalshi/categories";
import { isAuthorizedCron } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refresh the cached snapshot of live Kalshi events. Meant to be called on a
 * schedule (Vercel Cron or an external scheduler) so page loads read the cached
 * snapshot instead of hitting Kalshi on every request. Protected by a
 * `?token=<CRON_SECRET>` query parameter.
 */
async function handle(req: Request) {
  const { searchParams } = new URL(req.url);
  if (!isAuthorizedCron(searchParams.get("token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const events = await getAllLiveEvents();
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

    // Per-category counts make it easy to verify balance after a refresh.
    const byCategory: Record<string, number> = {};
    for (const e of events) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;

    return NextResponse.json({
      ok: true,
      count: events.length,
      byCategory,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// Vercel Cron (and external schedulers) trigger this via GET.
export const GET = handle;
