import { PREDICTION_MODEL } from "@/lib/env";
import { getCandles, getEvent } from "@/lib/kalshi/client";
import type { EventSummary, Market } from "@/lib/kalshi/types";
import { anthropic } from "./anthropic";
import {
  type PipelineEvent,
  researchingProgress,
  type Stage,
  STAGE_BASE,
  STAGE_LABEL,
} from "./progress";
import {
  type KalshiSnapshot,
  type PredictionResult,
  predictionJsonSchema,
} from "./schema";

// Only the top outcomes by Kalshi implied probability are deep-analyzed. Large
// multi-outcome events (e.g. "World Cup champion" with 20+ countries) would
// otherwise cost too much time/tokens to research per outcome and risk
// truncating the structured-output stage. The remaining outcomes are still
// passed to the model as compact context (and shown in the UI), just not
// individually researched.
const MAX_MARKETS_FOR_MODEL = 5;
const MAX_MARKETS_WITH_CANDLES = 5;
const MAX_PAUSE_CONTINUATIONS = 8;

/** Markets that are tradeable and carry a usable Kalshi price. */
function isAnalyzable(m: Market): boolean {
  const status = m.status.toLowerCase();
  const tradeable = status === "open" || status === "active";
  return tradeable && m.lastProbability != null;
}

/**
 * Pick the top outcomes by Kalshi implied probability for deep analysis. The
 * rest are returned as `others` for compact context only.
 */
function selectMarketsForAnalysis(event: EventSummary): {
  analyzed: Market[];
  others: Market[];
} {
  const ranked = event.markets
    .filter(isAnalyzable)
    .sort((a, b) => (b.lastProbability ?? -1) - (a.lastProbability ?? -1));
  return {
    analyzed: ranked.slice(0, MAX_MARKETS_FOR_MODEL),
    others: ranked.slice(MAX_MARKETS_FOR_MODEL),
  };
}

function progress(stage: Stage, message?: string, value?: number): PipelineEvent {
  return {
    type: "progress",
    stage,
    progress: value ?? STAGE_BASE[stage],
    message: message ?? STAGE_LABEL[stage],
  };
}

function daysBetween(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / (1000 * 60 * 60 * 24));
}

function marketLine(m: Market): string {
  const implied = m.lastProbability != null ? `${m.lastProbability.toFixed(0)}%` : "n/a";
  return `- "${m.title}" [${m.ticker}] — implied YES ${implied}, bid/ask ${
    m.yesBid?.toFixed(0) ?? "?"
  }/${m.yesAsk?.toFixed(0) ?? "?"}, volume ${m.volume.toLocaleString()}, OI ${m.openInterest.toLocaleString()}, status ${m.status}`;
}

function buildBrief(
  event: EventSummary,
  analyzed: Market[],
  others: Market[],
  candles: Record<string, { ts: number; close: number | null }[]>
): string {
  const close = event.closeTime;
  const dToClose = daysBetween(close);

  const lines: string[] = [];
  lines.push(`EVENT: ${event.title}`);
  if (event.subTitle) lines.push(`Subtitle: ${event.subTitle}`);
  lines.push(`Category: ${event.category}`);
  lines.push(`Event ticker: ${event.eventTicker}`);
  lines.push(
    `Mutually exclusive outcomes: ${event.mutuallyExclusive ? "yes (one outcome wins)" : "no"}`
  );
  lines.push(
    `Market close: ${close ?? "unknown"}${
      dToClose != null ? ` (${dToClose} day(s) from today)` : ""
    }`
  );
  lines.push("");
  lines.push(
    "MARKETS TO ANALYZE (top outcomes by Kalshi price = market-implied probabilities):"
  );
  for (const m of analyzed) lines.push(marketLine(m));

  if (others.length > 0) {
    lines.push("");
    lines.push(
      "OTHER OUTCOMES (context only — do NOT research or include in marketsAnalyzed):"
    );
    for (const m of others) {
      const implied = m.lastProbability != null ? `${m.lastProbability.toFixed(0)}%` : "n/a";
      lines.push(`- "${m.title}" — Kalshi ${implied}`);
    }
  }

  // Compact candle history for the analyzed markets
  const withCandles = analyzed.slice(0, MAX_MARKETS_WITH_CANDLES);
  for (const m of withCandles) {
    const series = candles[m.ticker];
    if (!series || series.length === 0) continue;
    const recent = series.slice(-30);
    const pts = recent
      .filter((p) => p.close != null)
      .map((p) => `${new Date(p.ts).toISOString().slice(0, 10)}:${p.close!.toFixed(0)}%`)
      .join(" ");
    if (pts) lines.push(`\nPrice history "${m.title}" [${m.ticker}] (YES prob): ${pts}`);
  }
  return lines.join("\n");
}

function researchSystemPrompt(todayIso: string): string {
  return `You are a world-class forecaster and analyst for prediction markets. Today is ${todayIso}.
Your job: rigorously estimate the probability of each outcome listed under "MARKETS TO ANALYZE", then identify the single most likely / best-supported one. Any "OTHER OUTCOMES" are provided only as context (e.g. to gauge the residual field in a mutually-exclusive event) — do not research them individually.

Method:
- Weigh the time remaining until the market closes against how much could still change.
- Treat Kalshi's current prices as the market-implied probability — a strong prior, but look for where evidence diverges from it.
- Use the web_search tool aggressively and repeatedly to gather current, real-world evidence. Tailor your research to the event type:
  - Sports: team/player records this season, recent form, head-to-head history, injuries, home/away, rankings.
  - Crypto / stocks / finance: recent price trend and momentum, key levels vs. the strike, macro and news catalysts before the close date.
  - Politics / elections: latest polling, fundamentals, scheduling, recent news and base rates.
  - Economics / climate / other: the relevant latest data releases, forecasts, and authoritative sources.
- Be quantitative. Cite concrete numbers and sources (include URLs).
- Account for the current date vs. the event's resolution date in your reasoning.

Deliver a thorough written analysis covering: each market's outcome probability, the key factors driving it (with direction and importance), any head-to-head / comparative stats where relevant, the main risks/uncertainties, and a clearly labeled list of SOURCES with URLs. This is a deep analysis — take the time and searches needed to be confident.`;
}

function structuredSystemPrompt(): string {
  return `You convert a detailed forecasting analysis into a strict JSON prediction object that exactly matches the provided schema.
Rules:
- probabilities and confidence are 0-100 numbers.
- marketsAnalyzed must contain ONLY the markets listed under "MARKETS TO ANALYZE" — never the "OTHER OUTCOMES". topPick must be one of those analyzed markets.
- topPick is the single outcome you are most confident about; "side" is YES if you expect that market to resolve YES, otherwise NO, and "probability" is the chance the picked side resolves true.
- For each analyzed market, set kalshiImpliedProbability from the Kalshi data provided, and edge = predictedProbability - kalshiImpliedProbability (null if implied unknown).
- keyPoints: the decisive factors, each with direction (impact) and relative weight.
- comparison: include head-to-head / comparative stats when relevant (e.g., two sports teams); otherwise null.
- sources: carry over the URLs cited in the analysis.
Output only the JSON object.`;
}

type AnyBlock = { type: string; text?: string; name?: string; input?: unknown };

function textOf(content: AnyBlock[]): string {
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

export async function* runPrediction(
  eventTicker: string
): AsyncGenerator<PipelineEvent> {
  const todayIso = new Date().toISOString().slice(0, 10);

  // ---- Stage 1: gather Kalshi data ----
  yield progress("gathering");
  const event = await getEvent(eventTicker);
  if (!event) {
    yield { type: "error", message: "Event not found on Kalshi." };
    return;
  }

  const { analyzed, others } = selectMarketsForAnalysis(event);

  const candles: KalshiSnapshot["candles"] = {};
  if (event.seriesTicker) {
    const withCandles = analyzed.slice(0, MAX_MARKETS_WITH_CANDLES);
    await Promise.all(
      withCandles.map(async (m) => {
        candles[m.ticker] = await getCandles(event.seriesTicker!, m.ticker, { days: 90 });
      })
    );
  }
  const snapshot: KalshiSnapshot = {
    event,
    candles,
    capturedAt: new Date().toISOString(),
  };
  const brief = buildBrief(event, analyzed, others, candles);

  // ---- Stage 2: deep research with web search ----
  yield progress("researching", STAGE_LABEL.researching, STAGE_BASE.researching);

  const client = anthropic();
  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    {
      role: "user",
      content: `Analyze this Kalshi event and forecast its outcome.\n\n${brief}\n\nResearch thoroughly with web_search, then write your full analysis.`,
    },
  ];

  let analysisText = "";
  let searchCount = 0;
  let continuations = 0;

  while (true) {
    const stream = client.messages.stream({
      model: PREDICTION_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive", display: "summarized" },
      // effort lives under output_config
      output_config: { effort: "high" },
      system: researchSystemPrompt(todayIso),
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    for await (const ev of stream) {
      const e = ev as { type: string; content_block?: { type?: string } };
      if (
        e.type === "content_block_start" &&
        e.content_block?.type === "server_tool_use"
      ) {
        searchCount += 1;
        yield progress(
          "researching",
          `Researching (search ${searchCount})…`,
          researchingProgress(searchCount)
        );
      }
    }

    const msg = await stream.finalMessage();
    const content = msg.content as unknown as AnyBlock[];
    analysisText += (analysisText ? "\n\n" : "") + textOf(content);

    if (msg.stop_reason === "pause_turn" && continuations < MAX_PAUSE_CONTINUATIONS) {
      continuations += 1;
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    break;
  }

  if (!analysisText.trim()) {
    yield { type: "error", message: "The model returned no analysis." };
    return;
  }

  // ---- Stage 3: structured prediction ----
  yield progress("analyzing");
  yield progress("finalizing");

  const structuredParams = {
    model: PREDICTION_MODEL,
    max_tokens: 8000,
    system: structuredSystemPrompt(),
    output_config: {
      format: { type: "json_schema", schema: predictionJsonSchema },
    },
    messages: [
      {
        role: "user",
        content: `Kalshi data:\n${brief}\n\n---\n\nAnalysis to convert into the structured prediction:\n${analysisText}`,
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const res = await client.messages.create(structuredParams);
  const jsonText = textOf((res as { content: AnyBlock[] }).content).trim();

  let result: PredictionResult;
  try {
    result = JSON.parse(jsonText) as PredictionResult;
  } catch {
    // Fallback: extract the first {...} block.
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) {
      yield { type: "error", message: "Failed to parse the structured prediction." };
      return;
    }
    result = JSON.parse(match[0]) as PredictionResult;
  }

  yield { type: "complete", result, snapshot };
}
