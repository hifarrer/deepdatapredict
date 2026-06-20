"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Loader2, ChevronRight } from "lucide-react";
import type { EventSummary } from "@/lib/kalshi/types";
import type { PredictionResult } from "@/lib/ai/schema";
import { EventCard } from "@/components/EventCard";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatPct } from "@/lib/utils";

export interface PredictionListItem {
  id: string;
  eventTitle: string;
  category: string | null;
  status: "RUNNING" | "COMPLETE" | "ERROR";
  slug: string | null;
  createdAt: string;
  result: PredictionResult | null;
  error: string | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

function StatusBadge({ status }: { status: PredictionListItem["status"] }) {
  if (status === "COMPLETE") return <Badge variant="emerald">Complete</Badge>;
  if (status === "RUNNING") return <Badge variant="amber">Running</Badge>;
  return <Badge variant="red">Error</Badge>;
}

function RowInner({ p }: { p: PredictionListItem }) {
  const pick = p.result?.topPick;
  return (
    <>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusBadge status={p.status} />
          {p.category && (
            <span className="text-xs text-slate-400">{p.category}</span>
          )}
          <span className="text-xs text-slate-400">
            {formatDateTime(p.createdAt)}
          </span>
        </div>
        <p className="mt-1 truncate font-medium text-slate-900">{p.eventTitle}</p>
        {pick && (
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {pick.title} · {pick.side} {formatPct(pick.probability)} ·{" "}
            {pick.confidenceLabel} confidence
          </p>
        )}
        {p.status === "ERROR" && p.error && (
          <p className="mt-0.5 truncate text-sm text-red-500">{p.error}</p>
        )}
      </div>
    </>
  );
}

function PredictionsTab({ predictions }: { predictions: PredictionListItem[] }) {
  if (predictions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        You haven&apos;t generated any predictions yet. Head to the dashboard to
        create your first one.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {predictions.map((p) => {
        // Completed predictions link out to their public, full analysis page.
        const linkable = p.status === "COMPLETE" && p.slug;
        const baseClass =
          "flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors";

        if (linkable) {
          return (
            <Link
              key={p.id}
              href={`/${p.slug}`}
              className={`${baseClass} hover:border-emerald-300 hover:bg-emerald-50/30`}
            >
              <RowInner p={p} />
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
          );
        }

        return (
          <div key={p.id} className={`${baseClass} cursor-default`}>
            <RowInner p={p} />
          </div>
        );
      })}
    </div>
  );
}

function ClosedEventsTab() {
  const { data, error, isLoading } = useSWR<{ events: EventSummary[] }>(
    "/api/events?status=settled&limit=24",
    fetcher,
    { revalidateOnFocus: false }
  );
  const events = data?.events ?? [];

  if (isLoading)
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (error)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Couldn&apos;t load closed events.
      </div>
    );
  if (events.length === 0)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        No recently closed events to show.
      </div>
    );

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <EventCard key={e.eventTicker} event={e} readOnly />
      ))}
    </div>
  );
}

export function HistoryClient({
  predictions,
}: {
  predictions: PredictionListItem[];
}) {
  const [tab, setTab] = useState("predictions");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">History</h1>
        <p className="text-sm text-slate-500">
          Your saved predictions and recently closed Kalshi events.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="predictions">My predictions</TabsTrigger>
          <TabsTrigger value="closed">Closed events</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "predictions" ? (
        <PredictionsTab predictions={predictions} />
      ) : (
        <ClosedEventsTab />
      )}
    </div>
  );
}
