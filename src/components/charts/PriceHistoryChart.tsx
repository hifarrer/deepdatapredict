"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CandlePoint } from "@/lib/kalshi/types";

export function PriceHistoryChart({ candles }: { candles: CandlePoint[] }) {
  const data = candles
    .filter((c) => c.close != null)
    .map((c) => ({
      date: new Date(c.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      prob: Math.round(c.close as number),
    }));

  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No price history available for this market.
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="probFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, "YES prob"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="prob"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#probFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
