import type { KalshiSnapshot, PredictionResult } from "./schema";

export type Stage =
  | "queued"
  | "gathering"
  | "researching"
  | "analyzing"
  | "finalizing"
  | "done"
  | "error";

export const STAGE_BASE: Record<Stage, number> = {
  queued: 2,
  gathering: 10,
  researching: 20, // grows toward ~75 as searches complete
  analyzing: 80,
  finalizing: 92,
  done: 100,
  error: 0,
};

export const STAGE_LABEL: Record<Stage, string> = {
  queued: "Queued",
  gathering: "Gathering Kalshi market data…",
  researching: "Researching with web search…",
  analyzing: "Analyzing findings…",
  finalizing: "Finalizing prediction…",
  done: "Complete",
  error: "Error",
};

/** Map an in-progress research step count to a percentage (20 → ~75). */
export function researchingProgress(searchCount: number): number {
  const capped = Math.min(searchCount, 10);
  return Math.round(STAGE_BASE.researching + capped * 5.5);
}

export type PipelineEvent =
  | { type: "progress"; stage: Stage; progress: number; message: string }
  | {
      type: "complete";
      result: PredictionResult;
      snapshot: KalshiSnapshot;
    }
  | { type: "error"; message: string };
