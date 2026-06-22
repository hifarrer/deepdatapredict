"use client";

import { useState } from "react";
import { Link2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import type { EventSummary } from "@/lib/kalshi/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/EventCard";

type Phase = "input" | "loading" | "found" | "error";

export function ImportUrlModal({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUrl("");
    setPhase("input");
    setEvent(null);
    setError(null);
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  async function lookup() {
    if (!url.trim()) return;
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch("/api/events/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't import that event.");
        setPhase("error");
        return;
      }
      setEvent(data.event as EventSummary);
      setPhase("found");
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="h-4 w-4" />
          Enter URL
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import an event by URL</DialogTitle>
          <DialogDescription>
            Paste a Kalshi event or market link to pull it in and generate a
            prediction — even if it isn&apos;t in our list yet.
          </DialogDescription>
        </DialogHeader>

        {(phase === "input" || phase === "loading") && (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="https://kalshi.com/markets/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") lookup();
                }}
                disabled={phase === "loading"}
                autoFocus
              />
              <Button onClick={lookup} disabled={phase === "loading" || !url.trim()}>
                {phase === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Look up event
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              e.g. https://kalshi.com/markets/kxwcgame/world-cup-game/kxwcgame-26jun22argaut
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4 py-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
            <p className="text-sm text-slate-600">{error}</p>
            <Button variant="outline" onClick={reset}>
              Try another URL
            </Button>
          </div>
        )}

        {phase === "found" && event && (
          <div className="space-y-3">
            {event.isLive ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Added to your events — generate a prediction below.
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" />
                This event has already ended or been determined. It&apos;s been
                added under &ldquo;Past Events&rdquo; and can be viewed but not
                predicted.
              </div>
            )}
            <EventCard event={event} readOnly={!event.isLive} />
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700"
            >
              Import another URL
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
