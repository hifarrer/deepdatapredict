"use client";

import { Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { orderSports } from "@/lib/kalshi/sports";
import { cn } from "@/lib/utils";

interface SportLeagueSidebarProps {
  /** Per-sport live-event counts (keys drive the rendered sport list). */
  sportCounts: Record<string, number>;
  /** Currently selected sport ("All" = no sport filter). */
  selectedSport: string;
  /** Select a sport, or "All" to clear. Clears any league selection. */
  onSelectSport: (sport: string) => void;
  /** Leagues available within the selected sport (empty when none/All). */
  leagues: string[];
  /** Per-league live-event counts within the selected sport. */
  leagueCounts: Record<string, number>;
  /** Currently selected league ("All" = no league filter). */
  selectedLeague: string;
  /** Select a league, or "All" to clear. */
  onSelectLeague: (league: string) => void;
}

function Count({ n }: { n: number }) {
  return <span className="ml-2 shrink-0 tabular-nums text-slate-400">({n})</span>;
}

export function SportLeagueSidebar({
  sportCounts,
  selectedSport,
  onSelectSport,
  leagues,
  leagueCounts,
  selectedLeague,
  onSelectLeague,
}: SportLeagueSidebarProps) {
  const sports = orderSports(Object.keys(sportCounts));
  const total = Object.values(sportCounts).reduce((s, n) => s + n, 0);

  const rowBase =
    "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm transition-colors";

  return (
    <nav aria-label="Sports and leagues" className="space-y-0.5">
      <button
        type="button"
        onClick={() => onSelectSport("All")}
        className={cn(
          rowBase,
          selectedSport === "All"
            ? "bg-emerald-50 font-semibold text-emerald-700"
            : "text-slate-600 hover:bg-slate-50"
        )}
      >
        <span className="truncate">All</span>
        <Count n={total} />
      </button>

      {sports.map((sport) => {
        const expanded = selectedSport === sport;
        const sportActive = expanded && selectedLeague === "All";
        return (
          <Fragment key={sport}>
            <button
              type="button"
              onClick={() => onSelectSport(sport)}
              className={cn(
                rowBase,
                sportActive
                  ? "bg-emerald-50 font-semibold text-emerald-700"
                  : expanded
                    ? "font-medium text-slate-900"
                    : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <span className="flex min-w-0 items-center gap-1">
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                )}
                <span className="truncate">{sport}</span>
              </span>
              <Count n={sportCounts[sport] ?? 0} />
            </button>

            {expanded && leagues.length > 0 && (
              <div className="ml-3 space-y-0.5 border-l border-slate-100 pl-2">
                {leagues.map((league) => (
                  <button
                    key={league}
                    type="button"
                    onClick={() => onSelectLeague(league)}
                    className={cn(
                      rowBase,
                      "py-1",
                      selectedLeague === league
                        ? "bg-emerald-50 font-semibold text-emerald-700"
                        : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <span className="truncate">{league}</span>
                    <Count n={leagueCounts[league] ?? 0} />
                  </button>
                ))}
              </div>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
