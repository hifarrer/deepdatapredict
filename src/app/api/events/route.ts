import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedLiveEvents } from "@/lib/kalshi/cache";
import { getEventsByStatus } from "@/lib/kalshi/client";
import { orderCategories, PAST_EVENTS_CATEGORY } from "@/lib/kalshi/categories";
import {
  orderSports,
  orderLeagues,
  leagueForEvent,
  sportForEvent,
  orderByMatch,
} from "@/lib/kalshi/sports";
import { getSiteSettings, limitForCategory, limitForSport } from "@/lib/settings";
import type { EventSummary } from "@/lib/kalshi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const subCategoryParam = searchParams.get("subCategory");
    const sub =
      subCategoryParam && subCategoryParam !== "All" ? subCategoryParam : null;
    const leagueParam = searchParams.get("league");
    const league =
      leagueParam && leagueParam !== "All" ? leagueParam : null;
    const q = searchParams.get("q")?.toLowerCase().trim();
    const status = searchParams.get("status") ?? "open";
    // Events are capped per category (admin-configurable), with a global
    // default for unconfigured categories and an overall ceiling on "All".
    // Sports are further capped per sport (subCategory).
    const settings = await getSiteSettings();

    const all =
      status === "open"
        ? await getCachedLiveEvents()
        : await getEventsByStatus(status, 80);

    // An event is "determined" once no market is open/tradeable (isLive=false).
    // These are pulled out of the live list and surfaced only under a synthetic
    // "Past Events" tab; the normal categories (and "All") show live events only.
    const isDetermined = (e: EventSummary) => !e.isLive;
    const liveEvents = all.filter((e) => !isDetermined(e));
    const pastEvents = all.filter(isDetermined);
    const isPastTab = category === PAST_EVENTS_CATEGORY;

    // Tabs are built from the live set; append "Past Events" last when any exist.
    const categories = orderCategories(liveEvents.map((e) => e.category));
    if (pastEvents.length > 0) categories.push(PAST_EVENTS_CATEGORY);

    // Resolve sport/league even on a stale snapshot (events normalized before
    // these fields existed): fall back to deriving them from the series ticker.
    const sportOf = (e: EventSummary) =>
      e.subCategory ?? sportForEvent(e.category, e.seriesTicker, e.title) ?? "Other";
    // Recompute league from the (evolving) heuristic rather than trusting the
    // stored value, so rule improvements take effect without a cron re-run.
    const leagueOf = (e: EventSummary) =>
      leagueForEvent(sportOf(e), e.seriesTicker, e.title) ?? "Other";

    // Sports present in the data, for the sub-filter chips under the Sports tab.
    const sports = orderSports(
      liveEvents.filter((e) => e.category === "Sports").map(sportOf)
    );
    const matchesSearch = (e: EventSummary) =>
      !q ||
      e.title.toLowerCase().includes(q) ||
      Boolean(e.subTitle?.toLowerCase().includes(q)) ||
      e.markets.some((m) => m.title.toLowerCase().includes(q));

    // Base set: category + search applied, but NOT the sport/league sub-filters,
    // so the sidebar counts reflect everything available (not just the slice shown).
    let base = isPastTab ? pastEvents : liveEvents;
    if (!isPastTab && category && category !== "All") {
      base = base.filter((e) => e.category === category);
    }
    base = base.filter(matchesSearch);

    // Per-sport counts, and (when a sport is selected) per-league counts + order,
    // for the Sports sidebar. Only meaningful under the Sports category.
    const sportCounts: Record<string, number> = {};
    let leagues: string[] = [];
    const leagueCounts: Record<string, number> = {};
    if (category === "Sports") {
      for (const e of base) {
        const s = sportOf(e);
        sportCounts[s] = (sportCounts[s] ?? 0) + 1;
      }
      if (sub) {
        const lc = new Map<string, number>();
        for (const e of base) {
          if (sportOf(e) !== sub) continue;
          const l = leagueOf(e);
          lc.set(l, (lc.get(l) ?? 0) + 1);
        }
        leagues = orderLeagues(lc);
        for (const [k, v] of lc) leagueCounts[k] = v;
      }
    }

    // Returned events: apply the sport and league sub-filters on top of the base.
    let filtered = base;
    if (category === "Sports" && sub) {
      filtered = filtered.filter((e) => sportOf(e) === sub);
    }
    if (category === "Sports" && sub && league) {
      filtered = filtered.filter((e) => leagueOf(e) === league);
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

    // Enrich returned events with the resolved sport/league so clients (event
    // cards, badges) see the same values used for grouping — including on a
    // stale snapshot where these fields weren't stored.
    const withFree: EventSummary[] = filtered.map((e) => ({
      ...e,
      ...(e.category === "Sports"
        ? { subCategory: sportOf(e), league: leagueOf(e) }
        : {}),
      freePredictionId: freeByTicker.get(e.eventTicker) ?? null,
    }));

    // Show all free (already-generated) events first; stable otherwise.
    withFree.sort(
      (a, b) => Number(Boolean(b.freePredictionId)) - Number(Boolean(a.freePredictionId))
    );

    // Group every match's events together and sink its prop markets (Goalscorer,
    // Total Goals, Spread…) below the match cards, so the list reads as the actual
    // matches first, then the props grouped per match — on every tab, including
    // the mixed "All" list (props sink; other categories stay up top). Under the
    // Sports tab (incl. a selected sport/league) the matches are additionally
    // ordered by kickoff — today's first — the way Kalshi's league pages do.
    const ordered = orderByMatch(withFree, {
      byKickoff: category === "Sports",
      mainsFirst: true,
    });

    // Cap events. Non-sports categories are capped to their per-category limit.
    // Sports are capped two ways: each sport to its per-sport limit, and the
    // Sports category as a whole to its category limit. A specific sport view
    // is capped only to that sport's limit. "All" applies the overall ceiling.
    let capped: EventSummary[];
    if (category === "Sports" && sub) {
      capped = ordered.slice(0, limitForSport(settings, sub));
    } else {
      const catCounts = new Map<string, number>();
      const sportCapCounts = new Map<string, number>();
      capped = [];
      for (const e of ordered) {
        if (e.category === "Sports") {
          const sport = sportOf(e);
          if ((sportCapCounts.get(sport) ?? 0) >= limitForSport(settings, sport)) continue;
          if ((catCounts.get("Sports") ?? 0) >= limitForCategory(settings, "Sports"))
            continue;
          sportCapCounts.set(sport, (sportCapCounts.get(sport) ?? 0) + 1);
          catCounts.set("Sports", (catCounts.get("Sports") ?? 0) + 1);
          capped.push(e);
        } else {
          if ((catCounts.get(e.category) ?? 0) >= limitForCategory(settings, e.category))
            continue;
          catCounts.set(e.category, (catCounts.get(e.category) ?? 0) + 1);
          capped.push(e);
        }
      }
      capped = capped.slice(0, settings.maxLiveEvents);
    }

    // URL-imported events are never dropped by the caps: if one passed the
    // active filters but got squeezed out above, surface it at the front.
    const cappedTickers = new Set(capped.map((e) => e.eventTicker));
    const droppedManual = ordered.filter(
      (e) => e.manual && !cappedTickers.has(e.eventTicker)
    );
    if (droppedManual.length > 0) {
      capped = [...droppedManual, ...capped];
    }

    return NextResponse.json({
      events: capped,
      categories,
      sports,
      sportCounts,
      leagues,
      leagueCounts,
      total: ordered.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load events";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
