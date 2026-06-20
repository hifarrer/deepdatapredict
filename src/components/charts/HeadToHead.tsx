"use client";

import type { ComparisonEntity } from "@/lib/ai/schema";

/**
 * Comparison table for head-to-head / multi-entity stats. Robust to string
 * values (records like "12-4", percentages, etc.), so rendered as a table.
 */
export function HeadToHead({
  title,
  entities,
}: {
  title: string;
  entities: ComparisonEntity[];
}) {
  if (!entities || entities.length === 0) return null;

  // Union of stat labels, preserving first-seen order.
  const labels: string[] = [];
  for (const e of entities) {
    for (const s of e.stats) if (!labels.includes(s.label)) labels.push(s.label);
  }

  const valueFor = (e: ComparisonEntity, label: string) =>
    e.stats.find((s) => s.label === label)?.value ?? "—";

  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-slate-900">{title}</h4>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-3 py-2 font-medium text-slate-500">Stat</th>
              {entities.map((e) => (
                <th key={e.name} className="px-3 py-2 font-semibold text-slate-900">
                  {e.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-500">{label}</td>
                {entities.map((e) => (
                  <td key={e.name} className="px-3 py-2 font-medium text-slate-800">
                    {valueFor(e, label)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
