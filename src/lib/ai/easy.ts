import { EASY_SCREEN_MODEL } from "@/lib/env";
import type { EventSummary, Market } from "@/lib/kalshi/types";
import { anthropic } from "./anthropic";

// ---- Public shapes ----

export interface EasyOutcome {
  ticker: string;
  title: string;
  kalshiProb: number | null; // implied YES probability 0-100 from market price
  aiProb: number | null; // quick AI estimate 0-100
  edge: number | null; // aiProb - kalshiProb (percentage points)
}

export interface EasyPick {
  /** Full summary so EventCard / PredictionModal render and Generate works. */
  event: EventSummary;
  predictability: number; // 0-100 screening score
  reason: string; // one-line "why this is forecastable"
  outcomes: EasyOutcome[];
  /** ISO timestamp of when the AI estimate was produced (for incremental reuse). */
  estimatedAt: string;
}

// ---- Tunables ----

const PICK_COUNT = 20;
const SCREEN_BATCH = 80; // events per screening call (keeps the prompt bounded)
// Cap how many (most-liquid) events get screened. Caps screening tokens and
// focuses picks on liquid events, which also carry more public information.
const SCREEN_CANDIDATE_CAP = 120;
const MAX_OUTCOMES = 8; // outcomes shown/estimated per event
// Picks are researched in parallel to keep the whole background run to a few
// minutes (each light estimate is ~40s, dominated by web-search round trips).
const ESTIMATE_CONCURRENCY = 6;
const ESTIMATE_DELAY_MS = 100; // small spacing between batches to ease rate limits
const MAX_PAUSE_CONTINUATIONS = 2;

// Phase-2 research uses Sonnet (hardcoded) — far cheaper than the Opus deep
// pipeline while still a strong forecaster for a quick estimate. The on-demand
// "Generate prediction" flow keeps using PREDICTION_MODEL (Opus) from .env.
const EASY_RESEARCH_MODEL = "claude-sonnet-4-6";
// Cap the number of web searches per pick — bounds the biggest token sink
// (fetched page content enters context per search). The web_search_20260209
// tool accepts max_uses but not max_content_tokens.
const WEB_SEARCH_MAX_USES = 3;

// Incremental reuse: skip re-researching a pick whose estimate is still fresh
// and whose Kalshi price hasn't meaningfully moved since it was estimated.
const REUSE_MAX_AGE_HOURS = 24;
const REUSE_MOVE_THRESHOLD_PTS = 6;

// ---- Small helpers (kept local; mirrors the patterns in predict.ts) ----

type AnyBlock = { type: string; text?: string; name?: string; input?: unknown };

function textOf(content: AnyBlock[]): string {
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / (1000 * 60 * 60 * 24));
}

/** Markets that are tradeable and carry a usable Kalshi price (cf. predict.ts). */
function isAnalyzable(m: Market): boolean {
  const status = m.status.toLowerCase();
  const tradeable = status === "open" || status === "active";
  return tradeable && m.lastProbability != null;
}

/** Top outcomes by implied probability, capped for token budget. */
function topOutcomes(event: EventSummary, limit = MAX_OUTCOMES): Market[] {
  return event.markets
    .filter(isAnalyzable)
    .sort((a, b) => (b.lastProbability ?? -1) - (a.lastProbability ?? -1))
    .slice(0, limit);
}

function pct(p: number | null | undefined): string {
  return p == null ? "n/a" : `${Math.round(p)}%`;
}

/** Parse the first/last JSON object out of a model response. */
function parseJsonObject<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

// ---- Phase 1: screen all events for predictability (no web search) ----

const screenSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "number" },
          predictability: { type: "number", description: "0-100" },
          reason: { type: "string", description: "<=140 chars, why forecastable" },
        },
        required: ["index", "predictability", "reason"],
      },
    },
  },
  required: ["scores"],
} as const;

interface ScreenScore {
  index: number;
  predictability: number;
  reason: string;
}

function screenSystemPrompt(todayIso: string): string {
  return `You are a forecasting triage analyst for prediction markets. Today is ${todayIso}.
You are given a numbered list of live Kalshi events. For EACH event, rate how confidently a diligent analyst could forecast its outcome RIGHT NOW using publicly available information (news, polling, official schedules, sports/stats records, market data, social signal).

Score "predictability" 0-100:
- HIGH (70-100): objective, verifiable resolution; near-to-medium term; abundant public information; a defensible, evidence-backed lean (not a coin flip).
- MEDIUM (40-69): forecastable but with real uncertainty or thinner information.
- LOW (0-39): effectively random, extremely far-dated noise, almost no public information, or pure chance.

Reward events where evidence points clearly one way. Penalize 50/50 toss-ups and events with no actionable information. Give a concise reason (<=140 chars) for each. Return a score for every index provided.`;
}

function screenLine(i: number, event: EventSummary): string {
  const d = daysUntil(event.closeTime);
  const outs = topOutcomes(event, 5)
    .map((m) => `${m.title} ${pct(m.lastProbability)}`)
    .join(", ");
  const close = d != null ? `closes in ${d}d` : "no close date";
  return `[${i}] "${event.title}" | ${event.category} | ${close} | outcomes: ${
    outs || "n/a"
  }`;
}

async function screenBatch(
  events: EventSummary[],
  offset: number,
  todayIso: string
): Promise<ScreenScore[]> {
  const lines = events.map((e, i) => screenLine(offset + i, e)).join("\n");
  const client = anthropic();
  const res = await client.messages.create({
    model: EASY_SCREEN_MODEL,
    max_tokens: 8000,
    system: screenSystemPrompt(todayIso),
    output_config: { format: { type: "json_schema", schema: screenSchema } },
    messages: [
      {
        role: "user",
        content: `Rate the predictability of each event below.\n\n${lines}`,
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  const jsonText = textOf((res as { content: AnyBlock[] }).content);
  const parsed = parseJsonObject<{ scores: ScreenScore[] }>(jsonText);
  return parsed?.scores ?? [];
}

/** Score every event for predictability, batching to keep prompts bounded. */
export async function screenEvents(events: EventSummary[]): Promise<ScreenScore[]> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const all: ScreenScore[] = [];
  for (let off = 0; off < events.length; off += SCREEN_BATCH) {
    const batch = events.slice(off, off + SCREEN_BATCH);
    const scores = await screenBatch(batch, off, todayIso);
    all.push(...scores);
  }
  return all;
}

// ---- Phase 2: quick per-outcome estimate with light web search ----

const estimateSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    outcomes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          ticker: { type: "string" },
          aiProbability: { type: "number", description: "0-100 chance YES" },
        },
        required: ["ticker", "aiProbability"],
      },
    },
  },
  required: ["outcomes"],
} as const;

function estimateBrief(event: EventSummary, markets: Market[]): string {
  const d = daysUntil(event.closeTime);
  const lines = [
    `EVENT: ${event.title}`,
    event.subTitle ? `Subtitle: ${event.subTitle}` : "",
    `Category: ${event.category}`,
    `Mutually exclusive: ${event.mutuallyExclusive ? "yes (one outcome wins)" : "no"}`,
    `Closes: ${event.closeTime ?? "unknown"}${d != null ? ` (${d} day(s) away)` : ""}`,
    "",
    "OUTCOMES (with Kalshi market-implied YES probability):",
    ...markets.map(
      (m) => `- "${m.title}" [${m.ticker}] — Kalshi ${pct(m.lastProbability)}`
    ),
  ];
  return lines.filter(Boolean).join("\n");
}

function researchSystemPrompt(todayIso: string): string {
  return `You are a sharp prediction-market forecaster. Today is ${todayIso}.
Do a QUICK but evidence-based estimate of each listed outcome's probability. Use the web_search tool a few times to pull the most relevant current facts (recent news, polling, schedules, stats, momentum). Treat Kalshi's prices as a strong prior and adjust where evidence clearly diverges. Be concise — this is a fast pass, not an exhaustive report. End with a short written rationale that states a probability for each outcome.`;
}

function extractSystemPrompt(): string {
  return `Convert the forecasting notes into a strict JSON object matching the schema. For each outcome ticker provided, output aiProbability as a 0-100 number (the chance that outcome resolves YES). Output only the JSON object.`;
}

/** Quick light-research estimate of per-outcome AI probabilities. */
export async function estimatePick(event: EventSummary): Promise<EasyOutcome[]> {
  const markets = topOutcomes(event);
  const base: EasyOutcome[] = markets.map((m) => ({
    ticker: m.ticker,
    title: m.title,
    kalshiProb: m.lastProbability,
    aiProb: null,
    edge: null,
  }));
  if (markets.length === 0) return base;

  const todayIso = new Date().toISOString().slice(0, 10);
  const brief = estimateBrief(event, markets);
  const client = anthropic();

  // 1) Light research with web search (free-form text).
  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    {
      role: "user",
      content: `Estimate the outcome probabilities for this event.\n\n${brief}\n\nResearch briefly with web_search, then give your estimates.`,
    },
  ];
  let notes = "";
  let continuations = 0;
  try {
    while (true) {
      const stream = client.messages.stream({
        model: EASY_RESEARCH_MODEL,
        max_tokens: 2500,
        output_config: { effort: "low" },
        system: researchSystemPrompt(todayIso),
        tools: [
          {
            type: "web_search_20260209",
            name: "web_search",
            max_uses: WEB_SEARCH_MAX_USES,
          },
        ],
        messages,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const msg = await stream.finalMessage();
      const content = msg.content as unknown as AnyBlock[];
      notes += (notes ? "\n\n" : "") + textOf(content);
      if (
        msg.stop_reason === "pause_turn" &&
        continuations < MAX_PAUSE_CONTINUATIONS
      ) {
        continuations += 1;
        messages.push({ role: "assistant", content: msg.content });
        continue;
      }
      break;
    }
  } catch {
    // Research failed — return Kalshi-only outcomes (page still renders).
    return base;
  }
  if (!notes.trim()) return base;

  // 2) Cheap structured extraction (no tools, screen model).
  let parsed: { outcomes: { ticker: string; aiProbability: number }[] } | null = null;
  try {
    const res = await client.messages.create({
      model: EASY_SCREEN_MODEL,
      max_tokens: 1500,
      system: extractSystemPrompt(),
      output_config: { format: { type: "json_schema", schema: estimateSchema } },
      messages: [
        {
          role: "user",
          content: `${brief}\n\n---\n\nForecasting notes:\n${notes}`,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const jsonText = textOf((res as { content: AnyBlock[] }).content);
    parsed = parseJsonObject(jsonText);
  } catch {
    return base;
  }

  const byTicker = new Map(
    (parsed?.outcomes ?? []).map((o) => [o.ticker, o.aiProbability])
  );
  return base.map((o) => {
    const ai = byTicker.get(o.ticker);
    const aiProb = typeof ai === "number" ? Math.max(0, Math.min(100, ai)) : null;
    return {
      ...o,
      aiProb,
      edge: aiProb != null && o.kalshiProb != null ? aiProb - o.kalshiProb : null,
    };
  });
}

// ---- Incremental reuse helpers ----

function isFresh(estimatedAt: string | undefined): boolean {
  if (!estimatedAt) return false;
  const t = new Date(estimatedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < REUSE_MAX_AGE_HOURS * 3_600_000;
}

function hasAiEstimate(prior: EasyPick): boolean {
  return prior.outcomes.some((o) => o.aiProb != null);
}

/** True if the current top outcomes diverge from the prior-priced ones enough
 *  to warrant a fresh estimate (a new top outcome, or a price move ≥ threshold). */
function kalshiMoved(prior: EasyPick, event: EventSummary): boolean {
  const priorKalshi = new Map(prior.outcomes.map((o) => [o.ticker, o.kalshiProb]));
  for (const m of topOutcomes(event)) {
    const before = priorKalshi.get(m.ticker);
    if (before == null) return true; // a new outcome entered the top set
    if (Math.abs((m.lastProbability as number) - before) >= REUSE_MOVE_THRESHOLD_PTS) {
      return true;
    }
  }
  return false;
}

/** Carry the prior AI estimate forward onto the current markets, recomputing
 *  edge against the (current) Kalshi price. */
function reusableOutcomes(prior: EasyPick, event: EventSummary): EasyOutcome[] {
  const priorAi = new Map(prior.outcomes.map((o) => [o.ticker, o.aiProb]));
  return topOutcomes(event).map((m) => {
    const kalshiProb = m.lastProbability;
    const aiProb = priorAi.get(m.ticker) ?? null;
    return {
      ticker: m.ticker,
      title: m.title,
      kalshiProb,
      aiProb,
      edge: aiProb != null && kalshiProb != null ? aiProb - kalshiProb : null,
    };
  });
}

// ---- Orchestration ----

/**
 * Screen events, pick the top N, and attach quick AI estimates. Picks whose
 * prior estimate is still fresh and whose Kalshi price hasn't moved are reused
 * from `priorPicks` (no API call); only new/stale/moved picks are re-researched.
 */
export async function buildEasyPicks(
  events: EventSummary[],
  priorPicks: EasyPick[] = []
): Promise<EasyPick[]> {
  // Only the most liquid live events with an analyzable outcome are screened.
  const candidates = events
    .filter((e) => e.isLive && topOutcomes(e, 1).length > 0)
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, SCREEN_CANDIDATE_CAP);
  if (candidates.length === 0) return [];

  const scores = await screenEvents(candidates);
  const scoreByIndex = new Map(scores.map((s) => [s.index, s]));

  // Rank by predictability; keep the top N that the screener actually scored.
  const ranked = candidates
    .map((event, index) => ({ event, score: scoreByIndex.get(index) }))
    .filter((r): r is { event: EventSummary; score: ScreenScore } => !!r.score)
    .sort((a, b) => b.score.predictability - a.score.predictability)
    .slice(0, PICK_COUNT);

  const priorByTicker = new Map(priorPicks.map((p) => [p.event.eventTicker, p]));
  const nowIso = new Date().toISOString();

  // Reused picks are filled inline; the rest are queued for research, preserving
  // the ranked order in the final array.
  const result: EasyPick[] = new Array(ranked.length);
  const toResearch: { idx: number; event: EventSummary; score: ScreenScore }[] = [];

  ranked.forEach((r, idx) => {
    const prior = priorByTicker.get(r.event.eventTicker);
    const canReuse =
      prior && isFresh(prior.estimatedAt) && hasAiEstimate(prior) && !kalshiMoved(prior, r.event);
    if (canReuse && prior) {
      result[idx] = {
        event: r.event,
        predictability: Math.round(r.score.predictability),
        reason: r.score.reason,
        outcomes: reusableOutcomes(prior, r.event),
        estimatedAt: prior.estimatedAt,
      };
    } else {
      toResearch.push({ idx, event: r.event, score: r.score });
    }
  });

  // Research only the picks that need it, with bounded concurrency.
  for (let i = 0; i < toResearch.length; i += ESTIMATE_CONCURRENCY) {
    const slice = toResearch.slice(i, i + ESTIMATE_CONCURRENCY);
    const outcomes = await Promise.all(slice.map((s) => estimatePick(s.event)));
    slice.forEach((s, j) => {
      result[s.idx] = {
        event: s.event,
        predictability: Math.round(s.score.predictability),
        reason: s.score.reason,
        outcomes: outcomes[j],
        estimatedAt: nowIso,
      };
    });
    if (i + ESTIMATE_CONCURRENCY < toResearch.length) {
      await new Promise((res) => setTimeout(res, ESTIMATE_DELAY_MS));
    }
  }

  return result;
}
