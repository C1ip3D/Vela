"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

interface DataPoint { date: string; gpa: number; term: number; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#253A5E]/80 bg-[#101828]/90 backdrop-blur-md p-3 text-xs shadow-xl">
      <p className="mb-2 font-medium text-[#E8ECFF]">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}40` }} />
          <span className="text-sm text-[#8B98B8]">{p.name}:</span>
          <span className="text-sm font-mono text-[#E8ECFF]">{p.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export function TrendChart({ data }: { data: DataPoint[] }) {
  const [filter, setFilter] = useState<"30d" | "90d" | "all">("all");
  const filtered = filter === "30d" ? data.slice(-1) : filter === "90d" ? data.slice(-3) : data;

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-[#8B98B8]">GPA Trend</span>
        <div className="flex gap-1">
          {(["30d", "90d", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs uppercase tracking-wider transition-all duration-200 ${filter === f
                ? "bg-[#818CF8]/15 text-[#A5B4FC] border border-[#818CF8]/20 shadow-[0_0_8px_rgba(129,140,248,0.1)]"
                : "text-[#8B98B8] hover:text-[#D4DAF0] border border-transparent"
                }`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={filtered} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(165,180,252,0.04)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#8B98B8", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis domain={[2.0, 4.0]} tick={{ fill: "#8B98B8", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="gpa" name="Cumulative GPA" stroke="#818CF8" strokeWidth={2} dot={{ r: 3, fill: "#818CF8", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#818CF8", stroke: "#A5B4FC", strokeWidth: 2 }} />
          <Line type="monotone" dataKey="term" name="Term GPA" stroke="#34D399" strokeWidth={1.5} dot={{ r: 2, fill: "#34D399", strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
