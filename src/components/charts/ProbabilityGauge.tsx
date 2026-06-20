"use client";

import { RadialBar, RadialBarChart, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { formatPct } from "@/lib/utils";

function colorFor(p: number): string {
  if (p >= 66) return "#059669"; // emerald
  if (p >= 40) return "#f59e0b"; // amber
  return "#dc2626"; // red
}

export function ProbabilityGauge({
  probability,
  impliedProbability,
  caption,
}: {
  probability: number;
  impliedProbability?: number | null;
  caption?: string;
}) {
  const value = Math.max(0, Math.min(100, probability));
  const fill = colorFor(value);
  const data = [{ name: "prob", value, fill }];

  return (
    <div className="relative flex flex-col items-center">
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="72%"
            outerRadius="100%"
            data={data}
            startAngle={220}
            endAngle={-40}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: "#f1f5f9" }}
              dataKey="value"
              cornerRadius={14}
              angleAxisId={0}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="pointer-events-none absolute inset-0 top-2 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color: fill }}>
          {formatPct(value)}
        </span>
        {caption && <span className="mt-0.5 text-xs font-medium text-slate-500">{caption}</span>}
      </div>
      {impliedProbability != null && (
        <p className="mt-1 text-xs text-slate-500">
          Kalshi implied: <span className="font-semibold text-slate-700">{formatPct(impliedProbability)}</span>
        </p>
      )}
    </div>
  );
}
