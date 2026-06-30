"use client";

import useSWR from "swr";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { EasyPick } from "@/lib/ai/easy";
import { EasyPredictionCard } from "@/components/EasyPredictionCard";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

interface EasyResponse {
  picks: EasyPick[];
  count: number;
  fetchedAt: string | null;
  error?: string;
}

const fetcher = async (url: string): Promise<EasyResponse> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load easy predictions");
  return data;
};

export function EasyPredictionsClient({
  authenticated = true,
}: {
  authenticated?: boolean;
}) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<EasyResponse>(
    "/api/easy-predictions",
    fetcher,
    { refreshInterval: 60_000, keepPreviousData: true, revalidateOnFocus: false }
  );

  const picks = data?.picks ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Sparkles className="h-6 w-6 text-emerald-600" />
            Easy Predictions
          </h1>
          <p className="text-sm text-slate-500">
            The live events our AI judged most forecastable from public information —
            with a quick AI estimate next to the current Kalshi price. Generate a full
            prediction for any of them.
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

      {data?.fetchedAt && (
        <p className="text-xs text-slate-400">
          Updated {formatDateTime(data.fetchedAt)}
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load easy predictions: {error.message}
        </div>
      )}

      {isLoading && !data && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && picks.length === 0 && !error && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          No easy predictions yet. They&apos;re generated on a schedule — check back
          soon.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((p) => (
          <EasyPredictionCard
            key={p.event.eventTicker}
            pick={p}
            authenticated={authenticated}
          />
        ))}
      </div>
    </div>
  );
}
