"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { KeyPoint } from "@/lib/ai/schema";

const IMPACT_COLOR: Record<KeyPoint["impact"], string> = {
  positive: "#059669",
  negative: "#dc2626",
  neutral: "#94a3b8",
};

export function FactorBarChart({ keyPoints }: { keyPoints: KeyPoint[] }) {
  const data = [...keyPoints]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8)
    .map((k) => ({
      label: k.point.length > 48 ? `${k.point.slice(0, 46)}…` : k.point,
      weight: Math.round(k.weight),
      impact: k.impact,
    }));

  if (data.length === 0) return null;

  return (
    <div style={{ height: Math.max(120, data.length * 38) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={200}
            tick={{ fontSize: 11, fill: "#475569" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => [`${value}`, "Weight"]}
            cursor={{ fill: "#f8fafc" }}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="weight" radius={[0, 6, 6, 0]} barSize={16}>
            {data.map((d, i) => (
              <Cell key={i} fill={IMPACT_COLOR[d.impact]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
