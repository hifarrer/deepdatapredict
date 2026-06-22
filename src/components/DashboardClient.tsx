"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { RefreshCw, Search, Loader2 } from "lucide-react";
import type { EventSummary } from "@/lib/kalshi/types";
import { EventCard } from "@/components/EventCard";
import { CategoryTabs } from "@/components/CategoryTabs";
import { SportLeagueSidebar } from "@/components/SportLeagueSidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EventsResponse {
  events: EventSummary[];
  categories: string[];
  sports: string[];
  sportCounts: Record<string, number>;
  leagues: string[];
  leagueCounts: Record<string, number>;
  total: number;
  fetchedAt: string;
  error?: string;
}

const fetcher = async (url: string): Promise<EventsResponse> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load events");
  return data;
};

export function DashboardClient() {
  const [category, setCategory] = useState("All");
  const [subCategory, setSubCategory] = useState("All");
  const [league, setLeague] = useState("All");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Selecting a category resets the sport and league sub-filters (Sports-only).
  function selectCategory(v: string) {
    setCategory(v);
    setSubCategory("All");
    setLeague("All");
  }

  // Selecting a sport clears any league selection (leagues belong to a sport).
  function selectSport(v: string) {
    setSubCategory(v);
    setLeague("All");
  }

  // No explicit limit: the server applies the admin-configured per-category and
  // per-sport caps. The sport/league sub-filters only apply under the Sports tab.
  const subParam =
    category === "Sports" && subCategory !== "All"
      ? `&subCategory=${encodeURIComponent(subCategory)}`
      : "";
  const leagueParam =
    category === "Sports" && subCategory !== "All" && league !== "All"
      ? `&league=${encodeURIComponent(league)}`
      : "";
  const key = `/api/events?category=${encodeURIComponent(
    category
  )}${subParam}${leagueParam}&q=${encodeURIComponent(debounced)}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<EventsResponse>(
    key,
    fetcher,
    { refreshInterval: 45_000, keepPreviousData: true, revalidateOnFocus: false }
  );

  const events = data?.events ?? [];
  const categories = data?.categories ?? [];
  const sports = data?.sports ?? [];
  const sportCounts = data?.sportCounts ?? {};
  const leagues = data?.leagues ?? [];
  const leagueCounts = data?.leagueCounts ?? {};
  const isSports = category === "Sports";

  // Event grid + its loading/empty/error states. The grid is a touch narrower
  // under Sports because the sidebar takes a column on large screens.
  const content = (
    <>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load live events: {error.message}
        </div>
      )}

      {isLoading && !data && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && events.length === 0 && !error && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          No live events match your filters right now.
        </div>
      )}

      <div
        className={`grid gap-5 sm:grid-cols-2 ${
          isSports ? "xl:grid-cols-3" : "lg:grid-cols-3"
        }`}
      >
        {events.map((e) => (
          <EventCard key={e.eventTicker} event={e} />
        ))}
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live events</h1>
          <p className="text-sm text-slate-500">
            Markets currently open on Kalshi · generate an AI prediction for any of them.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutate()}
          disabled={isValidating}
        >
          <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {categories.length > 0 && (
        <CategoryTabs
          categories={categories}
          value={category}
          onValueChange={selectCategory}
        />
      )}

      {isSports ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Mobile: sport + league chip rows fall back from the sidebar. */}
          <div className="space-y-2 lg:hidden">
            {sports.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-400">Filter by sport</p>
                <CategoryTabs
                  categories={sports}
                  value={subCategory}
                  onValueChange={selectSport}
                />
              </div>
            )}
            {subCategory !== "All" && leagues.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-400">Filter by league</p>
                <CategoryTabs
                  categories={leagues}
                  value={league}
                  onValueChange={setLeague}
                />
              </div>
            )}
          </div>

          {/* Desktop: Kalshi-style sport → league sidebar. */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <SportLeagueSidebar
              sportCounts={sportCounts}
              selectedSport={subCategory}
              onSelectSport={selectSport}
              leagues={leagues}
              leagueCounts={leagueCounts}
              selectedLeague={league}
              onSelectLeague={setLeague}
            />
          </aside>

          <div className="min-w-0 flex-1">{content}</div>
        </div>
      ) : (
        content
      )}
    </div>
  );
}
