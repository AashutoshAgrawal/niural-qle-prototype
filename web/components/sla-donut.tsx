"use client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { useState, useEffect } from "react";

export function SlaDonut({ counts }: { counts: { green: number; yellow: number; red: number } }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const data = [
    { name: "On track", value: counts.green, fill: "oklch(0.62 0.16 153)" },
    { name: "At risk", value: counts.yellow, fill: "oklch(0.74 0.16 70)" },
    { name: "Overdue", value: counts.red, fill: "oklch(0.6 0.21 27)" },
  ].filter((d) => d.value > 0);
  const total = counts.green + counts.yellow + counts.red;

  if (total === 0) {
    return <div className="h-44 flex items-center justify-center text-sm text-muted">No QLEs to chart</div>;
  }

  return (
    <div className="relative h-44 w-full">
      {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              stroke="oklch(1 0 0)"
              strokeWidth={2}
              isAnimationActive={true}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid oklch(0.92 0.004 264)",
                fontSize: 12,
                background: "oklch(1 0 0)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-2xl font-semibold tabular-nums">{total}</div>
        <div className="text-xs text-muted">Total</div>
      </div>
    </div>
  );
}
