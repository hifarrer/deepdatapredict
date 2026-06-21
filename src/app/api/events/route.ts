import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedLiveEvents } from "@/lib/kalshi/cache";
import { getEventsByStatus } from "@/lib/kalshi/client";
import { orderCategories } from "@/lib/kalshi/categories";
import { getSiteSettings, limitForCategory } from "@/lib/settings";
import type { EventSummary } from "@/lib/kalshi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const q = searchParams.get("q")?.toLowerCase().trim();
    const status = searchParams.get("status") ?? "open";
    // Events are capped per category (admin-configurable), with a global
    // default for unconfigured categories and an overall ceiling on "All".
    const settings = await getSiteSettings();

    const all =
      status === "open"
        ? await getCachedLiveEvents()
        : await getEventsByStatus(status, 80);
    const categories = orderCategories(all.map((e) => e.category));

    let filtered = all;
    if (category && category !== "All") {
      filtered = filtered.filter((e) => e.category === category);
    }
    if (q) {
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.subTitle?.toLowerCase().includes(q) ||
          e.markets.some((m) => m.title.toLowerCase().includes(q))
      );
    }

    // A prediction that has already been generated (by anyone) for an event is
    // free to view for everyone — no need to re-run the AI. Mark those events
    // and surface the most recent completed prediction's id.
    const freeByTicker = new Map<string, string>();
    if (filtered.length > 0) {
      const completed = await prisma.prediction.findMany({
        where: {
          eventTicker: { in: filtered.map((e) => e.eventTicker) },
          status: "COMPLETE",
        },
        select: { id: true, eventTicker: true },
        orderBy: { completedAt: "desc" },
      });
      for (const p of completed) {
        if (!freeByTicker.has(p.eventTicker)) freeByTicker.set(p.eventTicker, p.id);
      }
    }

    const withFree: EventSummary[] = filtered.map((e) => ({
      ...e,
      freePredictionId: freeByTicker.get(e.eventTicker) ?? null,
    }));

    // Show all free (already-generated) events first; stable otherwise.
    withFree.sort(
      (a, b) => Number(Boolean(b.freePredictionId)) - Number(Boolean(a.freePredictionId))
    );

    // Cap per category. For a specific category, cap to that category's limit.
    // For "All", cap each category independently then apply the overall ceiling
    // so high-volume categories can't crowd out low-volume ones.
    let capped: EventSummary[];
    if (category && category !== "All") {
      capped = withFree.slice(0, limitForCategory(settings, category));
    } else {
      const counts = new Map<string, number>();
      capped = [];
      for (const e of withFree) {
        const used = counts.get(e.category) ?? 0;
        if (used >= limitForCategory(settings, e.category)) continue;
        counts.set(e.category, used + 1);
        capped.push(e);
      }
      capped = capped.slice(0, settings.maxLiveEvents);
    }

    return NextResponse.json({
      events: capped,
      categories,
      total: withFree.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load events";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
