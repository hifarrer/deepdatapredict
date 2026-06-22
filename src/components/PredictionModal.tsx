"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, AlertCircle, ExternalLink } from "lucide-react";
import type { EventSummary } from "@/lib/kalshi/types";
import type { KalshiSnapshot, PredictionResult } from "@/lib/ai/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PredictionResultView } from "@/components/PredictionResultView";
import { cn } from "@/lib/utils";

type Phase = "idle" | "running" | "result" | "error" | "auth";

export function PredictionModal({
  event,
  triggerClassName,
  authenticated = true,
}: {
  event: EventSummary;
  triggerClassName?: string;
  /** When false, the trigger prompts the user to sign in instead of running. */
  authenticated?: boolean;
}) {
  const freeId = event.freePredictionId ?? null;
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(2);
  const [stage, setStage] = useState("Starting…");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [snapshot, setSnapshot] = useState<KalshiSnapshot | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const loadResult = useCallback(async (id: string) => {
    const res = await fetch(`/api/predictions/${id}`);
    if (!res.ok) throw new Error("Failed to load the saved prediction.");
    const data = await res.json();
    setResult(data.prediction.result as PredictionResult);
    setSnapshot((data.prediction.kalshiSnapshot as KalshiSnapshot) ?? null);
    setSlug((data.prediction.slug as string | null) ?? null);
    setPhase("result");
  }, []);

  const run = useCallback(async () => {
    setPhase("running");
    setProgress(2);
    setStage("Starting…");
    setError(null);
    setResult(null);
    setSlug(null);

    try {
      const createRes = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTicker: event.eventTicker,
          eventTitle: event.title,
          category: event.category,
        }),
      });
      if (createRes.status === 401) {
        setError("Please sign in to generate predictions.");
        setPhase("error");
        return;
      }
      if (createRes.status === 402) {
        setError(
          "You're out of prediction credits for this month. Upgrade your plan to keep going."
        );
        setPhase("error");
        return;
      }
      if (!createRes.ok) throw new Error("Could not start the prediction.");
      const { id } = await createRes.json();

      const streamRes = await fetch(`/api/predictions/${id}/stream`);
      if (!streamRes.ok || !streamRes.body) throw new Error("Stream failed to start.");

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = chunk
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice(5).trim());
          if (payload.type === "progress") {
            setProgress(payload.progress);
            setStage(payload.message);
          } else if (payload.type === "complete") {
            setProgress(100);
            setStage("Complete");
            await loadResult(payload.predictionId ?? id);
          } else if (payload.type === "error") {
            setError(payload.message);
            setPhase("error");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }, [event, loadResult]);

  const viewFree = useCallback(
    async (id: string) => {
      setPhase("running");
      setProgress(100);
      setStage("Loading saved prediction…");
      setError(null);
      try {
        await loadResult(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setPhase("error");
      }
    },
    [loadResult]
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    // Anonymous visitors can browse events but must sign in to view or
    // generate predictions — show the gate instead of starting the run.
    if (!authenticated) {
      setPhase("auth");
      return;
    }
    if (!startedRef.current) {
      startedRef.current = true;
      if (freeId) void viewFree(freeId);
      else void run();
    }
  };

  const restart = () => {
    startedRef.current = true;
    void run();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {freeId ? (
          <Button
            size="sm"
            className={cn(
              "bg-yellow-400 text-yellow-950 hover:bg-yellow-500",
              triggerClassName
            )}
          >
            <Sparkles className="h-4 w-4" />
            Free view
          </Button>
        ) : (
          <Button size="sm" className={triggerClassName}>
            <Sparkles className="h-4 w-4" />
            Generate prediction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="leading-snug">{event.title}</DialogTitle>
          <p className="text-sm text-slate-500">AI prediction · {event.category}</p>
        </DialogHeader>

        {phase === "auth" && (
          <div className="space-y-5 py-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Sparkles className="h-6 w-6" />
            </span>
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">
                {freeId ? "View this AI prediction" : "Generate an AI prediction"}
              </p>
              <p className="mx-auto max-w-sm text-sm text-slate-500">
                Log in or create a free account to{" "}
                {freeId ? "view" : "generate"} AI predictions for live Kalshi
                events.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button asChild>
                <Link href="/register?next=/dashboard">Create free account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/login?next=/dashboard">Log in</Link>
              </Button>
            </div>
          </div>
        )}

        {phase === "running" && (
          <div className="space-y-6 py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-sm font-medium text-slate-700">{stage}</p>
              <p className="max-w-sm text-xs text-slate-400">
                Running a deep analysis with live web research — this can take a
                couple of minutes. You can keep this open.
              </p>
            </div>
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-right text-xs tabular-nums text-slate-400">{progress}%</p>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4 py-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
            <p className="text-sm text-slate-600">{error}</p>
            {error?.toLowerCase().includes("sign in") ? (
              <Button asChild>
                <Link href={`/login?next=/dashboard`}>Sign in</Link>
              </Button>
            ) : error?.toLowerCase().includes("credit") ? (
              <Button asChild>
                <Link href="/plans">Upgrade your plan</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={restart}>
                Try again
              </Button>
            )}
          </div>
        )}

        {phase === "result" && result && (
          <div className="space-y-4">
            <PredictionResultView result={result} snapshot={snapshot} />
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
              {slug ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${slug}`} target="_blank">
                    <ExternalLink className="h-4 w-4" />
                    Open full page
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <Button variant="outline" size="sm" onClick={restart}>
                <Sparkles className="h-4 w-4" />
                Re-run analysis
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
