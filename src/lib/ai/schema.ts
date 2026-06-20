import type { CandlePoint, EventSummary } from "@/lib/kalshi/types";

// ---- Structured prediction result ----

export interface MarketAnalysis {
  ticker: string;
  title: string;
  predictedProbability: number; // 0-100, YES
  kalshiImpliedProbability: number | null; // 0-100 from market price
  edge: number | null; // predicted - implied (percentage points)
}

export interface KeyPoint {
  point: string;
  impact: "positive" | "negative" | "neutral";
  weight: number; // 0-100 relative importance
}

export interface ComparisonEntity {
  name: string;
  stats: { label: string; value: string }[];
}

export interface PredictionResult {
  headline: string;
  topPick: {
    ticker: string;
    title: string;
    side: "YES" | "NO";
    probability: number; // 0-100 chance the picked side resolves true
    confidence: number; // 0-100
    confidenceLabel: "Low" | "Medium" | "High";
  };
  summary: string;
  marketsAnalyzed: MarketAnalysis[];
  keyPoints: KeyPoint[];
  risks: string[];
  comparison: { title: string; entities: ComparisonEntity[] } | null;
  sources: { title: string; url: string }[];
}

// ---- Snapshot persisted with each prediction ----

export interface KalshiSnapshot {
  event: EventSummary;
  candles: Record<string, CandlePoint[]>;
  capturedAt: string;
}

// ---- JSON Schema for output_config.format (structured outputs) ----
// Constraints: every object needs additionalProperties:false and a `required`
// listing all keys. Nullability via type unions. No min/max constraints.

export const predictionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string", description: "One-line takeaway (<=120 chars)" },
    topPick: {
      type: "object",
      additionalProperties: false,
      properties: {
        ticker: { type: "string" },
        title: { type: "string" },
        side: { type: "string", enum: ["YES", "NO"] },
        probability: { type: "number", description: "0-100 chance picked side wins" },
        confidence: { type: "number", description: "0-100 confidence in the call" },
        confidenceLabel: { type: "string", enum: ["Low", "Medium", "High"] },
      },
      required: ["ticker", "title", "side", "probability", "confidence", "confidenceLabel"],
    },
    summary: { type: "string", description: "2-4 paragraph reasoning summary" },
    marketsAnalyzed: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          ticker: { type: "string" },
          title: { type: "string" },
          predictedProbability: { type: "number" },
          kalshiImpliedProbability: { type: ["number", "null"] },
          edge: { type: ["number", "null"] },
        },
        required: ["ticker", "title", "predictedProbability", "kalshiImpliedProbability", "edge"],
      },
    },
    keyPoints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          point: { type: "string" },
          impact: { type: "string", enum: ["positive", "negative", "neutral"] },
          weight: { type: "number", description: "0-100 relative importance" },
        },
        required: ["point", "impact", "weight"],
      },
    },
    risks: { type: "array", items: { type: "string" } },
    comparison: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            entities: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  stats: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        label: { type: "string" },
                        value: { type: "string" },
                      },
                      required: ["label", "value"],
                    },
                  },
                },
                required: ["name", "stats"],
              },
            },
          },
          required: ["title", "entities"],
        },
        { type: "null" },
      ],
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          url: { type: "string" },
        },
        required: ["title", "url"],
      },
    },
  },
  required: [
    "headline",
    "topPick",
    "summary",
    "marketsAnalyzed",
    "keyPoints",
    "risks",
    "comparison",
    "sources",
  ],
} as const;
